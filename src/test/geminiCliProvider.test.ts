import * as assert from 'assert';
import { GeminiCliProvider } from '../providers/geminiCliProvider';

// Mock the child_process module at the module level
let mockSpawn: any;
const originalRequire = require;

suite('GeminiCliProvider Security Test Suite', () => {
    let provider: GeminiCliProvider;
    let mockChild: any;
    let spawnCallArgs: any[] = [];

    setup(() => {
        // Reset call tracking
        spawnCallArgs = [];
        
        // Set up provider with test configuration
        provider = new GeminiCliProvider({
            geminiCliOAuthPath: '~/.gemini/oauth_creds.json',
            model: 'gemini-2.5-pro',
            temperature: 0.8,
            maxTokens: 1500
        } as any);

        // Mock child process
        mockChild = {
            stdout: {
                on: (event: string, callback: (data: Buffer) => void) => {
                    if (event === 'data') {
                        // Simulate successful response
                        setTimeout(() => {
                            callback(Buffer.from(JSON.stringify({
                                content: 'Mock response content',
                                usage: {
                                    prompt_tokens: 10,
                                    completion_tokens: 20,
                                    total_tokens: 30
                                }
                            })));
                        }, 0);
                    }
                }
            },
            stderr: {
                on: (event: string, callback: (data: Buffer) => void) => {
                    if (event === 'data') {
                        // No stderr data for successful test
                    }
                }
            },
            stdin: {
                write: (data: string) => { /* Mock write */ },
                end: () => { /* Mock end */ }
            },
            on: (event: string, callback: (code?: number, error?: Error) => void) => {
                if (event === 'close') {
                    setTimeout(() => callback(0), 0);
                } else if (event === 'error') {
                    // No error for successful test
                }
            }
        };

        // Set up default mock spawn
        mockSpawn = (command: string, args: string[], options: any) => {
            spawnCallArgs = [command, args, options];
            return mockChild;
        };
    });

    teardown(() => {
        // Clean up
        spawnCallArgs = [];
    });

    test('should use spawn with arguments array instead of exec with command string', async () => {
        // Mock the import by intercepting the require call within the provider
        const Module = require('module');
        const originalRequire = Module.prototype.require;
        
        Module.prototype.require = function(id: string) {
            if (id === 'child_process') {
                return { spawn: mockSpawn };
            }
            return originalRequire.apply(this, arguments);
        };

        try {
            const testPrompt = 'Test prompt for security validation';
            await provider.sendMessage(testPrompt);

            // Verify spawn was called with correct structure
            assert.strictEqual(spawnCallArgs.length, 3, 'spawn should be called with command, args array, and options');
            assert.strictEqual(spawnCallArgs[0], 'gemini', 'Command should be "gemini"');
            assert.ok(Array.isArray(spawnCallArgs[1]), 'Second argument should be an array of arguments');
            assert.ok(typeof spawnCallArgs[2] === 'object', 'Third argument should be options object');
        } finally {
            // Restore original require
            Module.prototype.require = originalRequire;
        }
    });

    test('should NOT expose API key in command arguments', async () => {
        const Module = require('module');
        const originalRequire = Module.prototype.require;
        
        Module.prototype.require = function(id: string) {
            if (id === 'child_process') {
                return { spawn: mockSpawn };
            }
            return originalRequire.apply(this, arguments);
        };

        try {
            await provider.sendMessage('Test prompt');

            // Verify API key is NOT in arguments
            const capturedArgs: string[] = spawnCallArgs[1] || [];
            const geminiCliOAuthPathInArgs = capturedArgs.some((arg: string) =>
                arg.includes('oauth') ||
                arg.includes('api-key') ||
                arg.includes('--api-key')
            );
            assert.strictEqual(geminiCliOAuthPathInArgs, false, 'API key should NOT be present in command arguments');
        } finally {
            Module.prototype.require = originalRequire;
        }
    });

    test('should NOT pass API key via environment variable', async () => {
        const Module = require('module');
        const originalRequire = Module.prototype.require;
        
        Module.prototype.require = function(id: string) {
            if (id === 'child_process') {
                return { spawn: mockSpawn };
            }
            return originalRequire.apply(this, arguments);
        };

        try {
            await provider.sendMessage('Test prompt');

            // Verify API key is NOT passed via environment
            const capturedEnv = spawnCallArgs[2]?.env || {};
            assert.strictEqual(capturedEnv.GEMINI_API_KEY, undefined, 'API key should NOT be passed via GEMINI_API_KEY environment variable');
        } finally {
            Module.prototype.require = originalRequire;
        }
    });

    test('should set default OAuth path when not provided', () => {
        // Create provider without geminiCliOAuthPath
        const providerWithoutOAuthPath = new GeminiCliProvider({
            model: 'gemini-2.5-pro'
        } as any);

        // Validate config which should set the default path
        const isValid = providerWithoutOAuthPath.validateConfig();
        
        // Check that validation passes
        assert.strictEqual(isValid, true, 'Should validate with default OAuth path');
        
        // Check that the default path was set
        assert.strictEqual((providerWithoutOAuthPath as any).config.geminiCliOAuthPath, '~/.gemini/oauth_creds.json', 'Should set default OAuth path');
    });

    test('should avoid shell interpolation by using stdio pipes', async () => {
        const Module = require('module');
        const originalRequire = Module.prototype.require;
        
        Module.prototype.require = function(id: string) {
            if (id === 'child_process') {
                return { spawn: mockSpawn };
            }
            return originalRequire.apply(this, arguments);
        };

        try {
            await provider.sendMessage('Test prompt');

            // Verify stdio configuration prevents shell interpolation
            const capturedOptions = spawnCallArgs[2] || {};
            assert.ok(capturedOptions.stdio, 'stdio option should be specified');
            assert.deepStrictEqual(capturedOptions.stdio, ['pipe', 'pipe', 'pipe'], 'stdio should use pipes for all streams');
        } finally {
            Module.prototype.require = originalRequire;
        }
    });

    test('should handle JSON parsing errors safely', async () => {
        // Mock child process that returns invalid JSON
        const badJsonMockChild = {
            ...mockChild,
            stdout: {
                on: (event: string, callback: (data: Buffer) => void) => {
                    if (event === 'data') {
                        setTimeout(() => {
                            callback(Buffer.from('invalid json response'));
                        }, 0);
                    }
                }
            }
        };

        const customMockSpawn = () => badJsonMockChild;

        const Module = require('module');
        const originalRequire = Module.prototype.require;
        
        Module.prototype.require = function(id: string) {
            if (id === 'child_process') {
                return { spawn: customMockSpawn };
            }
            return originalRequire.apply(this, arguments);
        };

        try {
            await provider.sendMessage('Test prompt');
            assert.fail('Should throw error for invalid JSON');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw an Error instance');
            assert.ok(error.message.includes('Failed to parse Gemini CLI response as JSON'), 
                'Error message should indicate JSON parsing failure');
        } finally {
            Module.prototype.require = originalRequire;
        }
    });

    test('should handle process exit codes correctly', async () => {
        // Mock child process that exits with non-zero code
        const failingMockChild = {
            ...mockChild,
            stderr: {
                on: (event: string, callback: (data: Buffer) => void) => {
                    if (event === 'data') {
                        setTimeout(() => {
                            callback(Buffer.from('Error message from CLI'));
                        }, 0);
                    }
                }
            },
            on: (event: string, callback: (code?: number) => void) => {
                if (event === 'close') {
                    setTimeout(() => callback(1), 0); // Exit with error code
                }
            }
        };

        const customMockSpawn = () => failingMockChild;

        const Module = require('module');
        const originalRequire = Module.prototype.require;
        
        Module.prototype.require = function(id: string) {
            if (id === 'child_process') {
                return { spawn: customMockSpawn };
            }
            return originalRequire.apply(this, arguments);
        };

        try {
            await provider.sendMessage('Test prompt');
            assert.fail('Should throw error for non-zero exit code');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw an Error instance');
            assert.ok(error.message.includes('exited with code 1'), 
                'Error message should indicate exit code');
        } finally {
            Module.prototype.require = originalRequire;
        }
    });

    test('should validate configuration correctly and set default OAuth path', () => {
        const validProviderWithOAuthPath = new GeminiCliProvider({
            geminiCliOAuthPath: '~/.gemini/oauth_creds.json',
            model: 'gemini-2.5-pro'
        } as any);

        const providerWithoutOAuthPath = new GeminiCliProvider({
            model: 'gemini-2.5-pro'
        } as any);

        // Both should validate successfully
        assert.strictEqual(validProviderWithOAuthPath.validateConfig(), true, 'Should validate with OAuth path');
        assert.strictEqual(providerWithoutOAuthPath.validateConfig(), true, 'Should validate and set default OAuth path');
        
        // Check that default path was set
        assert.strictEqual((providerWithoutOAuthPath as any).config.geminiCliOAuthPath, '~/.gemini/oauth_creds.json', 'Should set default OAuth path');
    });

    test('should return correct provider name and default model', () => {
        assert.strictEqual(provider.getName(), 'Gemini CLI');
        assert.strictEqual(provider.getDefaultModel(), 'gemini-2.5-pro');
        
        const providerWithCustomModel = new GeminiCliProvider({
            geminiCliOAuthPath: '~/.gemini/oauth_creds.json',
            model: 'custom-model'
        } as any);
        assert.strictEqual(providerWithCustomModel.getDefaultModel(), 'custom-model');
    });

    test('should expand ~ to home directory in OAuth path', (done) => {
        const homeDir = require('os').homedir();
        const providerWithTildePath = new GeminiCliProvider({
            geminiCliOAuthPath: '~/custom/path/oauth_creds.json',
            model: 'gemini-2.5-pro'
        } as any);

        // Call validateConfig to trigger path expansion
        providerWithTildePath.validateConfig();

        // Create a custom mock spawn to capture environment
        let capturedOptions: any;
        const customMockSpawn = (command: string, args: string[], options: any) => {
            capturedOptions = options;
            spawnCallArgs = [command, args, options];
            return mockChild;
        };

        // Mock the import by intercepting the require call within the provider
        const Module = require('module');
        const originalRequire = Module.prototype.require;
        
        Module.prototype.require = function(id: string) {
            if (id === 'child_process') {
                return { spawn: customMockSpawn };
            }
            return originalRequire.apply(this, arguments);
        };

        // Call sendMessage to trigger environment setup
        providerWithTildePath.sendMessage('test prompt')
            .then(() => {
                // Verify the path was expanded
                const capturedEnv = capturedOptions?.env || {};
                assert.strictEqual(capturedEnv.GEMINI_OAUTH_CREDS, `${homeDir}/custom/path/oauth_creds.json`, 'Should expand ~ to home directory');
                Module.prototype.require = originalRequire;
                done();
            })
            .catch((error) => {
                Module.prototype.require = originalRequire;
                done(error);
            });
    });
});