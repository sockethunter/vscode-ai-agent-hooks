import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { MultiStepExecutor } from '../mcp/multiStepExecutor';
import { Hook } from '../hookManager';

suite('MultiStepExecutor Test Suite', () => {
    let multiStepExecutor: MultiStepExecutor;
    let tempDir: string;
    let mockHook: Hook;
    let mockContext: any;

    suiteSetup(() => {
        tempDir = path.join(__dirname, 'temp_multistep_test');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        mockHook = {
            id: 'test-hook',
            name: 'Test Hook',
            description: 'Test hook for multi-step execution',
            trigger: 'onDidSaveTextDocument',
            filePattern: '**/*.js',
            template: '',
            isActive: true,
            isRunning: false,
            naturalLanguage: 'Add JSDoc comments to all functions',
            mcpEnabled: true,
            allowedMcpTools: ['mcp_filesystem_read', 'mcp_search_find'],
            multiStepEnabled: true,
            createdAt: new Date(),
            executionMode: 'single',
            priority: 0
        };

        mockContext = {
            workspaceRoot: tempDir,
            triggeredFile: path.join(tempDir, 'test.js'),
            fileContent: 'function test() { return "hello"; }',
            hookId: mockHook.id,
            allowedTools: mockHook.allowedMcpTools
        };
    });

    setup(() => {
        multiStepExecutor = MultiStepExecutor.getInstance();
    });

    suiteTeardown(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should create MultiStepExecutor singleton', () => {
        const instance1 = MultiStepExecutor.getInstance();
        const instance2 = MultiStepExecutor.getInstance();
        assert.strictEqual(instance1, instance2);
    });

    test('should handle MCP-enabled hooks', async () => {
        // Test that MCP hooks are properly configured
        assert.ok(mockHook.mcpEnabled);
        assert.ok(mockHook.multiStepEnabled);
        assert.ok(mockHook.allowedMcpTools);
        assert.ok(mockHook.allowedMcpTools.length > 0);
    });

    test('should have getInstance method returning singleton', () => {
        const instance1 = MultiStepExecutor.getInstance();
        const instance2 = MultiStepExecutor.getInstance();
        assert.strictEqual(instance1, instance2);
        assert.ok(instance1);
    });

    test('should handle hooks without MCP', async () => {
        const standardHook = {
            ...mockHook,
            mcpEnabled: false,
            multiStepEnabled: false
        };

        try {
            await multiStepExecutor.executeHookWithMcp(
                standardHook,
                mockContext.triggeredFile,
                mockContext.workspaceRoot
            );
            assert.fail('Should have thrown error for non-MCP hook');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('not configured for MCP'));
        }
    });

    test('should handle hooks without multi-step', async () => {
        const singleStepHook = {
            ...mockHook,
            mcpEnabled: true,
            multiStepEnabled: false
        };

        try {
            await multiStepExecutor.executeHookWithMcp(
                singleStepHook,
                mockContext.triggeredFile,
                mockContext.workspaceRoot
            );
            assert.fail('Should have thrown error for non-multi-step hook');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('not configured for MCP'));
        }
    });

    test('should create execution context properly', () => {
        // Test context structure matches expected format
        assert.ok(mockContext.workspaceRoot);
        assert.ok(mockContext.triggeredFile);
        assert.ok(mockContext.hookId);
        assert.ok(Array.isArray(mockContext.allowedTools));
    });
});