import * as assert from 'assert';
import { GeminiCliProvider } from '../providers/geminiCliProvider';

suite('GeminiCliProvider Security Test Suite', () => {
    let provider: GeminiCliProvider;
    let spawnCallArgs: any[] = [];
    let originalSpawn: any;

    setup(() => {
        // Reset call tracking
        spawnCallArgs = [];
        
        // Set up provider with test configuration
        provider = new GeminiCliProvider({
            geminiCliOAuthPath: '~/.gemini/oauth_creds.json',
            model: 'gemini-2.5-flash',
            temperature: 0.8,
            maxTokens: 1500
        } as any);
    });

    teardown(() => {
        // Clean up
        spawnCallArgs = [];
        // Restore original spawn if it was mocked
        if (originalSpawn) {
            const childProcess = require('child_process');
            childProcess.spawn = originalSpawn;
            originalSpawn = null;
        }
    });

    function createMockChild(stdout: string = '', stderr: string = '', exitCode: number = 0) {
        const EventEmitter = require('events');
        const mockChild = new EventEmitter();
        
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        mockChild.stdin = {
            write: () => {},
            end: () => {}
        };

        // Simulate the async behavior
        process.nextTick(() => {
            if (stdout) {
                mockChild.stdout.emit('data', Buffer.from(stdout));
            }
            if (stderr) {
                mockChild.stderr.emit('data', Buffer.from(stderr));
            }
            // Emit close after a short delay
            setTimeout(() => {
                mockChild.emit('close', exitCode);
            }, 5);
        });

        return mockChild;
    }

    function mockSpawn(stdout: string = '', stderr: string = '', exitCode: number = 0) {
        const childProcess = require('child_process');
        originalSpawn = childProcess.spawn;
        
        childProcess.spawn = (command: string, args: string[], options: any) => {
            spawnCallArgs = [command, args, options];
            return createMockChild(stdout, stderr, exitCode);
        };
    }

    test('should use spawn with arguments array instead of exec with command string', async () => {
        const successResponse = JSON.stringify({
            content: 'Mock response content',
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        });
        
        mockSpawn(successResponse);

        const testPrompt = 'Test prompt for security validation';
        await provider.sendMessage(testPrompt);

        // Verify spawn was called with correct structure
        assert.strictEqual(spawnCallArgs.length, 3, 'spawn should be called with command, args array, and options');
        assert.strictEqual(spawnCallArgs[0], 'gemini', 'Command should be "gemini"');
        assert.ok(Array.isArray(spawnCallArgs[1]), 'Second argument should be an array of arguments');
        assert.ok(typeof spawnCallArgs[2] === 'object', 'Third argument should be options object');
    });

    test('should NOT expose API key in command arguments', async () => {
        const successResponse = JSON.stringify({
            content: 'Mock response content',
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        });
        
        mockSpawn(successResponse);
        await provider.sendMessage('Test prompt');

        // Verify API key is NOT in arguments
        const capturedArgs: string[] = spawnCallArgs[1] || [];
        const geminiCliOAuthPathInArgs = capturedArgs.some((arg: string) =>
            arg.includes('oauth') ||
            arg.includes('api-key') ||
            arg.includes('--api-key')
        );
        assert.strictEqual(geminiCliOAuthPathInArgs, false, 'API key should NOT be present in command arguments');
    });

    test('should NOT pass API key via environment variable', async () => {
        const successResponse = JSON.stringify({
            content: 'Mock response content',
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        });
        
        mockSpawn(successResponse);
        await provider.sendMessage('Test prompt');

        // Verify API key is NOT passed via environment
        const capturedEnv = spawnCallArgs[2]?.env || {};
        assert.strictEqual(capturedEnv.GEMINI_API_KEY, undefined, 'API key should NOT be passed via GEMINI_API_KEY environment variable');
    });

    test('should set default OAuth path when not provided', () => {
        // Create provider without geminiCliOAuthPath
        const providerWithoutOAuthPath = new GeminiCliProvider({
            model: 'gemini-2.5-flash'
        } as any);

        // Validate config which should set the default path
        const isValid = providerWithoutOAuthPath.validateConfig();
        
        // Check that validation passes
        assert.strictEqual(isValid, true, 'Should validate with default OAuth path');
        
        // Check that the default path was set
        assert.strictEqual((providerWithoutOAuthPath as any).config.geminiCliOAuthPath, '~/.gemini/oauth_creds.json', 'Should set default OAuth path');
    });

    test('should avoid shell interpolation by using stdio pipes', async () => {
        const successResponse = JSON.stringify({
            content: 'Mock response content',
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        });
        
        mockSpawn(successResponse);
        await provider.sendMessage('Test prompt');

        // Verify stdio configuration prevents shell interpolation
        const capturedOptions = spawnCallArgs[2] || {};
        assert.ok(capturedOptions.stdio, 'stdio option should be specified');
        assert.deepStrictEqual(capturedOptions.stdio, ['pipe', 'pipe', 'pipe'], 'stdio should use pipes for all streams');
    });

    test('should handle JSON parsing errors safely', async () => {
        // Mock with invalid JSON response
        mockSpawn('invalid json response');
        
        // Should not throw error for invalid JSON - it should handle it gracefully
        // The provider treats invalid JSON as plain text response
        const result = await provider.sendMessage('Test prompt');
        assert.ok(result.content, 'Should return content even with invalid JSON');
        assert.strictEqual(result.content, 'invalid json response', 'Should use raw response as content');
    });

    test('should handle process exit codes correctly', async () => {
        // Mock with error exit code
        mockSpawn('', 'Error message from CLI', 1);

        try {
            await provider.sendMessage('Test prompt');
            assert.fail('Should throw error for non-zero exit code');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw an Error instance');
            assert.ok(error.message.includes('exited with code 1'),
                'Error message should indicate exit code');
        }
    });

    test('should validate configuration correctly and set default OAuth path', () => {
        const validProviderWithOAuthPath = new GeminiCliProvider({
            geminiCliOAuthPath: '~/.gemini/oauth_creds.json',
            model: 'gemini-2.5-flash'
        } as any);

        const providerWithoutOAuthPath = new GeminiCliProvider({
            model: 'gemini-2.5-flash'
        } as any);

        // Both should validate successfully
        assert.strictEqual(validProviderWithOAuthPath.validateConfig(), true, 'Should validate with OAuth path');
        assert.strictEqual(providerWithoutOAuthPath.validateConfig(), true, 'Should validate and set default OAuth path');
        
        // Check that default path was set
        assert.strictEqual((providerWithoutOAuthPath as any).config.geminiCliOAuthPath, '~/.gemini/oauth_creds.json', 'Should set default OAuth path');
    });

    test('should return correct provider name and default model', () => {
        assert.strictEqual(provider.getName(), 'Gemini CLI');
        assert.strictEqual(provider.getDefaultModel(), 'gemini-2.5-flash');
        
        const providerWithCustomModel = new GeminiCliProvider({
            geminiCliOAuthPath: '~/.gemini/oauth_creds.json',
            model: 'custom-model'
        } as any);
        assert.strictEqual(providerWithCustomModel.getDefaultModel(), 'custom-model');
    });

    test('should expand ~ to home directory in OAuth path', async () => {
        const homeDir = require('os').homedir();
        const providerWithTildePath = new GeminiCliProvider({
            geminiCliOAuthPath: '~/custom/path/oauth_creds.json',
            model: 'gemini-2.5-flash'
        } as any);

        // Call validateConfig to trigger path expansion
        providerWithTildePath.validateConfig();

        const successResponse = JSON.stringify({
            content: 'Mock response content',
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
        });
        
        mockSpawn(successResponse);
        await providerWithTildePath.sendMessage('test prompt');

        // Verify the path was expanded
        const capturedEnv = spawnCallArgs[2]?.env || {};
        assert.strictEqual(capturedEnv.GEMINI_OAUTH_CREDS, `${homeDir}/custom/path/oauth_creds.json`, 'Should expand ~ to home directory');
    });
});