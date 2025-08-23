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
            apiKey: 'test-api-key-sensitive',
            model: 'gemini-2.5-pro',
            temperature: 0.8,
            maxTokens: 1500
        });

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
            const apiKeyInArgs = capturedArgs.some((arg: string) => 
                arg.includes('test-api-key-sensitive') || 
                arg.includes('api-key') ||
                arg.includes('--api-key')
            );
            assert.strictEqual(apiKeyInArgs, false, 'API key should NOT be present in command arguments');
        } finally {
            Module.prototype.require = originalRequire;
        }
    });

    test('should pass API key via environment variable', async () => {
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

            // Verify API key is passed via environment
            const capturedEnv = spawnCallArgs[2]?.env || {};
            assert.ok(capturedEnv.GEMINI_API_KEY, 'API key should be passed via GEMINI_API_KEY environment variable');
            assert.strictEqual(capturedEnv.GEMINI_API_KEY, 'test-api-key-sensitive', 'Environment variable should contain the correct API key');
        } finally {
            Module.prototype.require = originalRequire;
        }
    });

    test('should use stdin for prompt input instead of command line argument', async () => {
        let stdinWrites: string[] = [];
        let stdinEnded = false;

        // Enhanced mock to capture stdin operations
        const enhancedMockChild = {
            ...mockChild,
            stdin: {
                write: (data: string) => {
                    stdinWrites.push(data);
                },
                end: () => {
                    stdinEnded = true;
                }
            }
        };

        const customMockSpawn = () => enhancedMockChild;

        const Module = require('module');
        const originalRequire = Module.prototype.require;
        
        Module.prototype.require = function(id: string) {
            if (id === 'child_process') {
                return { spawn: customMockSpawn };
            }
            return originalRequire.apply(this, arguments);
        };

        try {
            const testPrompt = 'Test prompt with "quotes" and special chars: $()[]{};';
            await provider.sendMessage(testPrompt);

            // Verify prompt was written to stdin
            assert.ok(stdinWrites.length > 0, 'Prompt should be written to stdin');
            assert.ok(stdinWrites.includes(testPrompt), 'Exact prompt should be written to stdin');
            assert.ok(stdinEnded, 'stdin should be ended after writing prompt');
        } finally {
            Module.prototype.require = originalRequire;
        }
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

    test('should validate configuration correctly', () => {
        const validProvider = new GeminiCliProvider({
            apiKey: 'valid-key',
            model: 'gemini-2.5-pro'
        });

        const invalidProvider = new GeminiCliProvider({
            apiKey: '',
            model: 'gemini-2.5-pro'
        });

        assert.strictEqual(validProvider.validateConfig(), true, 'Should validate with API key');
        assert.strictEqual(invalidProvider.validateConfig(), false, 'Should not validate without API key');
    });

    test('should return correct provider name and default model', () => {
        assert.strictEqual(provider.getName(), 'Gemini CLI');
        assert.strictEqual(provider.getDefaultModel(), 'gemini-2.5-pro');
        
        const providerWithCustomModel = new GeminiCliProvider({
            apiKey: 'test-key',
            model: 'custom-model'
        });
        assert.strictEqual(providerWithCustomModel.getDefaultModel(), 'custom-model');
    });
});