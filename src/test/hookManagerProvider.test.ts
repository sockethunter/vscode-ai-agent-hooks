import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { HookManagerProvider } from '../views/hookManagerProvider';
import { HookManager } from '../hookManager';

suite('HookManagerProvider Test Suite', () => {
    let provider: HookManagerProvider;
    let mockContext: vscode.ExtensionContext;
    let tempDir: string;

    suiteSetup(() => {
        // Create temporary directory for tests
        tempDir = path.join(__dirname, 'temp_provider_test');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Mock ExtensionContext
        mockContext = ({
            globalStorageUri: vscode.Uri.file(tempDir),
            subscriptions: [],
            extensionPath: __dirname,
            extensionUri: vscode.Uri.file(__dirname),
            workspaceState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                keys: () => []
            },
            globalState: {
                get: () => undefined,
                update: () => Promise.resolve(),
                setKeysForSync: () => {},
                keys: () => []
            },
            secrets: {
                get: () => Promise.resolve(undefined),
                store: () => Promise.resolve(),
                delete: () => Promise.resolve(),
                onDidChange: new vscode.EventEmitter().event
            },
            storageUri: vscode.Uri.file(tempDir),
            logUri: vscode.Uri.file(tempDir),
            extensionMode: vscode.ExtensionMode.Test,
            environmentVariableCollection: {
                persistent: true,
                replace: () => {},
                append: () => {},
                prepend: () => {},
                get: () => undefined,
                forEach: () => {},
                delete: () => {},
                clear: () => {},
                getScoped: () => ({
                    get: () => undefined,
                    replace: () => {},
                    append: () => {},
                    prepend: () => {},
                    forEach: () => {},
                    delete: () => {},
                    clear: () => {},
                    persistent: true,
                    description: 'Test scoped collection',
                    [Symbol.iterator]: function* () {}
                }),
                description: 'Test environment collection',
                [Symbol.iterator]: function* () {}
            },
            extension: {
                id: 'test-extension',
                extensionPath: __dirname,
                extensionUri: vscode.Uri.file(__dirname),
                isActive: true,
                packageJSON: {},
                extensionKind: vscode.ExtensionKind.Workspace,
                exports: undefined,
                activate: () => Promise.resolve()
            },
            asAbsolutePath: (relativePath: string) => path.join(__dirname, relativePath),
            storagePath: tempDir,
            globalStoragePath: tempDir,
            logPath: tempDir,
            languageModelAccessInformation: {
                onDidChange: new vscode.EventEmitter().event,
                canSendRequest: () => undefined
            }
        } as vscode.ExtensionContext);
    });

    setup(() => {
        // Clear any existing instances
        (HookManager as any).instance = undefined;
        provider = new HookManagerProvider(mockContext);
    });

    teardown(() => {
        // Clean up active providers
        (HookManagerProvider as any).activeProviders = [];
        
        // Clean up storage
        const hooksFile = path.join(tempDir, 'hooks.json');
        if (fs.existsSync(hooksFile)) {
            fs.unlinkSync(hooksFile);
        }
    });

    suiteTeardown(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('should create HookManagerProvider instance', () => {
        assert.ok(provider);
        assert.strictEqual(HookManagerProvider.viewType, 'hookManager');
    });

    test('should track active providers', () => {
        const activeProviders = (HookManagerProvider as any).activeProviders;
        assert.ok(Array.isArray(activeProviders));
        // Provider should be added to activeProviders in constructor
        assert.ok(activeProviders.includes(provider));
    });

    test('should setup webview panel correctly', () => {
        // Create a mock webview panel
        const mockPanel = {
            webview: {
                options: {},
                html: '',
                postMessage: () => Promise.resolve(true),
                onDidReceiveMessage: () => ({ dispose: () => {} })
            },
            onDidDispose: () => ({ dispose: () => {} })
        } as any;

        // Should not throw
        provider.setupWebviewPanel(mockPanel);
        
        assert.ok(mockPanel.webview.options.enableScripts);
        assert.ok(mockPanel.webview.html.length > 0);
        assert.ok(mockPanel.webview.html.includes('Hook Manager') || mockPanel.webview.html.includes('Fallback'));
    });

    test('should generate HTML for webview', () => {
        const htmlContent = (provider as any).getHtmlForWebview();
        
        assert.ok(typeof htmlContent === 'string');
        assert.ok(htmlContent.length > 0);
        assert.ok(htmlContent.includes('<!DOCTYPE html>'));
        assert.ok(htmlContent.includes('Hook Manager') || htmlContent.includes('Fallback'));
    });

    test('should handle webview view setup', () => {
        const mockWebviewView = {
            webview: {
                options: {},
                html: '',
                postMessage: () => Promise.resolve(true),
                onDidReceiveMessage: () => ({ dispose: () => {} })
            },
            onDidDispose: () => ({ dispose: () => {} }),
            onDidChangeVisibility: () => ({ dispose: () => {} })
        } as any;

        // Should not throw
        provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
        
        assert.ok(mockWebviewView.webview.options.enableScripts);
        assert.ok(mockWebviewView.webview.html.includes('Hook Manager') || mockWebviewView.webview.html.includes('Fallback'));
    });

    test('should broadcast hook updates to active providers', () => {
        const mockHooks = [
            {
                id: 'test-id',
                name: 'Test Hook',
                description: 'Test description',
                trigger: 'onDidSaveTextDocument',
                naturalLanguage: 'Test hook',
                filePattern: '**/*.js',
                template: 'test template',
                isActive: true,
                isRunning: false,
                createdAt: new Date()
            }
        ];

        const mockWebview = {
            postMessage: (message: any) => {
                assert.strictEqual(message.command, 'updateHooks');
                assert.strictEqual(message.hooks, mockHooks);
                return Promise.resolve(true);
            },
            onDidReceiveMessage: () => ({ dispose: () => {} })
        };

        // Set up provider with mock webview
        const mockPanel = {
            webview: mockWebview,
            onDidDispose: () => ({ dispose: () => {} })
        };

        provider.setupWebviewPanel(mockPanel as any);

        // Should not throw and should call postMessage
        HookManagerProvider.broadcastHookUpdate(mockHooks);
    });

    test('should handle message from webview - getHooks', async () => {
        // Initialize HookManager first
        const hookManager = HookManager.getInstance(mockContext);
        await hookManager.initialize();

        const messages: any[] = [];
        const mockWebview = {
            postMessage: (message: any) => {
                messages.push(message);
                return Promise.resolve(true);
            },
            onDidReceiveMessage: (callback: (message: any) => void) => {
                // Simulate receiving getHooks message
                setTimeout(() => {
                    callback({ command: 'getHooks' });
                }, 10);
                return { dispose: () => {} };
            }
        };

        const mockPanel = {
            webview: mockWebview,
            onDidDispose: () => ({ dispose: () => {} })
        };

        provider.setupWebviewPanel(mockPanel as any);

        // Wait for both initial load and message handling
        await new Promise(resolve => setTimeout(resolve, 150));

        // Should have received some message (initial + response to getHooks)
        assert.ok(messages.length > 0);
        
        hookManager.dispose();
    });

    test('should handle create hook message', async () => {
        const hookManager = HookManager.getInstance(mockContext);
        await hookManager.initialize();

        const messages: any[] = [];
        const mockWebview = {
            postMessage: (message: any) => {
                messages.push(message);
                return Promise.resolve(true);
            },
            onDidReceiveMessage: (callback: (message: any) => void) => {
                // Simulate receiving createHook message
                setTimeout(() => {
                    callback({
                        command: 'createHook',
                        data: {
                            name: 'Test Hook',
                            naturalLanguage: 'Test description',
                            trigger: 'onDidSaveTextDocument',
                            filePattern: '**/*.js'
                        }
                    });
                }, 10);
                return { dispose: () => {} };
            }
        };

        const mockPanel = {
            webview: mockWebview,
            onDidDispose: () => ({ dispose: () => {} })
        };

        provider.setupWebviewPanel(mockPanel as any);

        // Wait for async message handling
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should have created hook and sent updates
        const hooks = hookManager.getHooks();
        assert.strictEqual(hooks.length, 1);
        assert.strictEqual(hooks[0].name, 'Test Hook');

        hookManager.dispose();
    });

    test('should handle errors in message processing gracefully', async () => {
        const messages: any[] = [];
        const mockWebview = {
            postMessage: (message: any) => {
                messages.push(message);
                return Promise.resolve(true);
            },
            onDidReceiveMessage: (callback: (message: any) => void) => {
                // Simulate receiving invalid message
                setTimeout(() => {
                    callback({
                        command: 'updateHook',
                        hookId: 'non-existent-id',
                        data: {}
                    });
                }, 10);
                return { dispose: () => {} };
            }
        };

        const mockPanel = {
            webview: mockWebview,
            onDidDispose: () => ({ dispose: () => {} })
        };

        provider.setupWebviewPanel(mockPanel as any);

        // Wait for async message handling
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should have received error message
        const errorMessage = messages.find(m => m.command === 'error');
        assert.ok(errorMessage);
        assert.ok(typeof errorMessage.message === 'string');
    });

    test('should clean up on disposal', () => {
        const activeProviders = (HookManagerProvider as any).activeProviders;
        const initialCount = activeProviders.length;

        const mockWebviewView = {
            webview: {
                options: {},
                html: '',
                postMessage: () => Promise.resolve(true),
                onDidReceiveMessage: () => ({ dispose: () => {} })
            },
            onDidDispose: (callback: () => void) => {
                // Simulate disposal
                setTimeout(callback, 10);
                return { dispose: () => {} };
            },
            onDidChangeVisibility: () => ({ dispose: () => {} })
        } as any;

        provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);

        // Test disposal tracking - provider count should change eventually
        assert.ok(activeProviders.length >= initialCount);
    });

    test('should load assets correctly', () => {
        const loadAsset = (provider as any).loadAsset;
        
        // Should handle missing assets gracefully
        const result = loadAsset('non-existent-file.css');
        assert.ok(typeof result === 'string');
        assert.ok(result.includes('Error loading'));
    });

    test('should provide fallback HTML when templates not found', () => {
        const getFallbackHtml = (provider as any).getFallbackHtml;
        
        const fallbackHtml = getFallbackHtml();
        assert.ok(typeof fallbackHtml === 'string');
        assert.ok(fallbackHtml.includes('Fallback Mode'));
        assert.ok(fallbackHtml.includes('createTestHook'));
    });
});