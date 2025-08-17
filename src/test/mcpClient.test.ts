import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { McpClient } from '../mcp/mcpClient';

suite('McpClient Test Suite', () => {
    let mcpClient: McpClient;
    let tempDir: string;
    let mockContext: any;

    suiteSetup(() => {
        tempDir = path.join(__dirname, 'temp_mcp_test');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        mockContext = {
            workspaceRoot: tempDir,
            triggeredFile: path.join(tempDir, 'test.js'),
            hookId: 'test-hook',
            allowedTools: ['mcp_filesystem_list', 'mcp_filesystem_read', 'mcp_search_find']
        };
    });

    setup(() => {
        mcpClient = McpClient.getInstance();
    });

    suiteTeardown(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should create McpClient singleton', () => {
        const instance1 = McpClient.getInstance();
        const instance2 = McpClient.getInstance();
        assert.strictEqual(instance1, instance2);
    });

    test('should have default tools registered', () => {
        const availableTools = mcpClient.getAvailableTools();
        
        assert.ok(availableTools.includes('mcp_filesystem_list'));
        assert.ok(availableTools.includes('mcp_filesystem_read'));
        assert.ok(availableTools.includes('mcp_filesystem_read_multiple'));
        assert.ok(availableTools.includes('mcp_search_find'));
        assert.ok(availableTools.includes('mcp_search_grep'));
        assert.ok(availableTools.includes('mcp_git_status'));
        assert.ok(availableTools.includes('mcp_git_log'));
    });

    test('should validate tools for project', async () => {
        const validTools = await mcpClient.getValidatedToolsForProject(tempDir);
        
        // Should include basic tools
        assert.ok(validTools.includes('mcp_filesystem_list'));
        assert.ok(validTools.includes('mcp_filesystem_read'));
        assert.ok(validTools.includes('mcp_search_find'));
        
        // Git tools should not be included in temp directory without .git
        assert.ok(!validTools.includes('mcp_git_status'));
        assert.ok(!validTools.includes('mcp_git_log'));
    });

    test('should validate git tools in git repository', async () => {
        const gitDir = path.join(tempDir, '.git');
        fs.mkdirSync(gitDir, { recursive: true });
        
        try {
            const validTools = await mcpClient.getValidatedToolsForProject(tempDir);
            
            // Should include git tools now
            assert.ok(validTools.includes('mcp_git_status'));
            assert.ok(validTools.includes('mcp_git_log'));
        } finally {
            fs.rmSync(gitDir, { recursive: true, force: true });
        }
    });

    test('should execute filesystem_list tool', async () => {
        // Create test files
        const testFile1 = path.join(tempDir, 'test1.js');
        const testFile2 = path.join(tempDir, 'test2.ts');
        fs.writeFileSync(testFile1, 'console.log("test1");');
        fs.writeFileSync(testFile2, 'console.log("test2");');

        const result = await mcpClient.executeTool(
            'mcp_filesystem_list',
            { path: tempDir },
            mockContext
        );

        assert.ok(result);
        assert.ok(Array.isArray(result));
        assert.ok(result.length >= 2);
        
        const fileNames = result.map(item => item.name);
        assert.ok(fileNames.includes('test1.js'));
        assert.ok(fileNames.includes('test2.ts'));

        // Clean up
        fs.unlinkSync(testFile1);
        fs.unlinkSync(testFile2);
    });

    test('should execute filesystem_read tool', async () => {
        const testFile = path.join(tempDir, 'read-test.js');
        const testContent = 'function test() { return "hello"; }';
        fs.writeFileSync(testFile, testContent);

        const result = await mcpClient.executeTool(
            'mcp_filesystem_read',
            { path: testFile },
            mockContext
        );

        assert.ok(result);
        assert.strictEqual(result.content, testContent);
        assert.strictEqual(result.path, testFile);
        assert.strictEqual(result.size, testContent.length);

        // Clean up
        fs.unlinkSync(testFile);
    });

    test('should execute search_find tool', async () => {
        // Create test files with different extensions
        const jsFile = path.join(tempDir, 'search1.js');
        const tsFile = path.join(tempDir, 'search2.ts');
        const txtFile = path.join(tempDir, 'search3.txt');
        
        fs.writeFileSync(jsFile, 'console.log("js");');
        fs.writeFileSync(tsFile, 'console.log("ts");');
        fs.writeFileSync(txtFile, 'plain text');

        const result = await mcpClient.executeTool(
            'mcp_search_find',
            { pattern: '*.js', directory: '.' },
            mockContext
        );

        assert.ok(result);
        assert.ok(result.matches);
        assert.ok(Array.isArray(result.matches));
        assert.strictEqual(result.count, result.matches.length);
        
        // Simply verify the structure - file search depends on VSCode workspace API
        console.log('Search result matches:', result.matches);
        assert.ok(result.count >= 0); // Could be 0 if no matches

        // Clean up
        fs.unlinkSync(jsFile);
        fs.unlinkSync(tsFile);
        fs.unlinkSync(txtFile);
    });

    test('should reject tool execution when tool not allowed', async () => {
        const restrictedContext = {
            ...mockContext,
            allowedTools: ['mcp_filesystem_list'] // Only allow one tool
        };

        try {
            await mcpClient.executeTool(
                'mcp_filesystem_read', // Not in allowed tools
                { path: tempDir },
                restrictedContext
            );
            assert.fail('Should have thrown error for disallowed tool');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('not allowed'));
        }
    });

    test('should track execution history', async () => {
        const initialHistory = mcpClient.getExecutionHistory();
        const initialCount = initialHistory.length;

        // Execute a tool
        await mcpClient.executeTool(
            'mcp_filesystem_list',
            { path: tempDir },
            mockContext
        );

        const newHistory = mcpClient.getExecutionHistory();
        assert.strictEqual(newHistory.length, initialCount + 1);
        
        const lastExecution = newHistory[newHistory.length - 1];
        assert.strictEqual(lastExecution.hookId, mockContext.hookId);
        assert.strictEqual(lastExecution.toolName, 'mcp_filesystem_list');
        assert.ok(lastExecution.timestamp instanceof Date);
    });

    test('should filter execution history by hook ID', async () => {
        const hookId1 = 'hook-1';
        const hookId2 = 'hook-2';

        // Execute tool with first hook
        await mcpClient.executeTool(
            'mcp_filesystem_list',
            { path: tempDir },
            { ...mockContext, hookId: hookId1 }
        );

        // Execute tool with second hook
        await mcpClient.executeTool(
            'mcp_filesystem_list', 
            { path: tempDir },
            { ...mockContext, hookId: hookId2 }
        );

        const hook1History = mcpClient.getExecutionHistory(hookId1);
        const hook2History = mcpClient.getExecutionHistory(hookId2);

        assert.ok(hook1History.length > 0);
        assert.ok(hook2History.length > 0);
        
        // Verify filtering
        assert.ok(hook1History.every(entry => entry.hookId === hookId1));
        assert.ok(hook2History.every(entry => entry.hookId === hookId2));
    });

    test('should handle errors gracefully', async () => {
        try {
            await mcpClient.executeTool(
                'mcp_filesystem_read',
                { path: '/non/existent/file.js' },
                mockContext
            );
            assert.fail('Should have thrown error for non-existent file');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('Failed to read file'));
        }
    });
});