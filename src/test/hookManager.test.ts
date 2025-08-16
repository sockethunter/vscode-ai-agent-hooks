import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { HookManager } from '../hookManager';

suite('HookManager Test Suite', () => {
    let hookManager: HookManager;
    let mockContext: vscode.ExtensionContext;
    let tempDir: string;

    suiteSetup(async () => {
        // Create temporary directory for tests
        tempDir = path.join(__dirname, 'temp_test_storage');
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

    setup(async () => {
        // Clear any existing instances
        (HookManager as any).instance = undefined;
        
        // Create fresh instance
        hookManager = HookManager.getInstance(mockContext);
        await hookManager.initialize();
    });

    teardown(async () => {
        // Clean up after each test
        if (hookManager) {
            hookManager.dispose();
        }
        
        // Clear storage
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

    test('should create HookManager singleton', () => {
        assert.ok(hookManager);
        const secondInstance = HookManager.getInstance();
        assert.strictEqual(hookManager, secondInstance);
    });

    test('should initialize with empty hooks array', () => {
        const hooks = hookManager.getHooks();
        assert.strictEqual(hooks.length, 0);
    });

    test('should create hook from webview data', async () => {
        const hookData = {
            name: 'Test Hook',
            naturalLanguage: 'Test description',
            trigger: 'onDidSaveTextDocument',
            filePattern: '**/*.js'
        };

        await hookManager.createHookFromWebview(hookData);
        
        const hooks = hookManager.getHooks();
        assert.strictEqual(hooks.length, 1);
        
        const hook = hooks[0];
        assert.strictEqual(hook.name, 'Test Hook');
        assert.strictEqual(hook.naturalLanguage, 'Test description');
        assert.strictEqual(hook.trigger, 'onDidSaveTextDocument');
        assert.strictEqual(hook.filePattern, '**/*.js');
        assert.strictEqual(hook.isActive, true);
        assert.strictEqual(hook.isRunning, false);
        assert.ok(hook.id);
        assert.ok(hook.createdAt);
    });

    test('should toggle hook active state', async () => {
        const hookData = {
            name: 'Toggle Test Hook',
            naturalLanguage: 'Test toggle',
            trigger: 'onDidSaveTextDocument',
            filePattern: '**/*.ts'
        };

        await hookManager.createHookFromWebview(hookData);
        const hooks = hookManager.getHooks();
        const hookId = hooks[0].id;

        // Initially active
        assert.strictEqual(hooks[0].isActive, true);

        // Toggle to inactive
        await hookManager.toggleHookFromWebview(hookId);
        assert.strictEqual(hooks[0].isActive, false);

        // Toggle back to active
        await hookManager.toggleHookFromWebview(hookId);
        assert.strictEqual(hooks[0].isActive, true);
    });

    test('should delete hook', async () => {
        const hookData = {
            name: 'Delete Test Hook',
            naturalLanguage: 'Test delete',
            trigger: 'onDidSaveTextDocument',
            filePattern: '**/*.py'
        };

        await hookManager.createHookFromWebview(hookData);
        let hooks = hookManager.getHooks();
        assert.strictEqual(hooks.length, 1);
        
        const hookId = hooks[0].id;
        await hookManager.deleteHookFromWebview(hookId);
        
        hooks = hookManager.getHooks();
        assert.strictEqual(hooks.length, 0);
    });

    test('should update hook status', async () => {
        const hookData = {
            name: 'Status Test Hook',
            naturalLanguage: 'Test status',
            trigger: 'onDidSaveTextDocument',
            filePattern: '**/*.md'
        };

        await hookManager.createHookFromWebview(hookData);
        const hooks = hookManager.getHooks();
        const hookId = hooks[0].id;
        const testDate = new Date();

        // Update to running
        hookManager.updateHookStatus(hookId, true, testDate);
        assert.strictEqual(hooks[0].isRunning, true);
        assert.strictEqual(hooks[0].lastExecuted?.getTime(), testDate.getTime());

        // Update to not running
        hookManager.updateHookStatus(hookId, false);
        assert.strictEqual(hooks[0].isRunning, false);
    });

    test('should update hook from webview', async () => {
        const hookData = {
            name: 'Update Test Hook',
            naturalLanguage: 'Original description',
            trigger: 'onDidSaveTextDocument',
            filePattern: '**/*.js'
        };

        await hookManager.createHookFromWebview(hookData);
        const hooks = hookManager.getHooks();
        const hookId = hooks[0].id;

        const updateData = {
            name: 'Updated Hook Name',
            naturalLanguage: 'Updated description',
            trigger: 'onDidChangeTextDocument',
            filePattern: '**/*.ts'
        };

        await hookManager.updateHookFromWebview(hookId, updateData);

        const updatedHook = hooks[0];
        assert.strictEqual(updatedHook.name, 'Updated Hook Name');
        assert.strictEqual(updatedHook.naturalLanguage, 'Updated description');
        assert.strictEqual(updatedHook.trigger, 'onDidChangeTextDocument');
        assert.strictEqual(updatedHook.filePattern, '**/*.ts');
    });

    test('should persist hooks to storage', async () => {
        const hookData = {
            name: 'Persistence Test Hook',
            naturalLanguage: 'Test persistence',
            trigger: 'onDidSaveTextDocument',
            filePattern: '**/*.json'
        };

        await hookManager.createHookFromWebview(hookData);
        
        // Create new instance to test loading
        hookManager.dispose();
        (HookManager as any).instance = undefined;
        
        const newHookManager = HookManager.getInstance(mockContext);
        await newHookManager.initialize();
        
        const hooks = newHookManager.getHooks();
        assert.strictEqual(hooks.length, 1);
        assert.strictEqual(hooks[0].name, 'Persistence Test Hook');
        
        newHookManager.dispose();
    });

    test('should handle invalid hook ID for operations', async () => {
        const invalidId = 'non-existent-id';
        
        // These should not throw errors
        await hookManager.toggleHookFromWebview(invalidId);
        await hookManager.deleteHookFromWebview(invalidId);
        await hookManager.stopHookFromWebview(invalidId);
        hookManager.updateHookStatus(invalidId, true);
        
        // Should throw error for update
        try {
            await hookManager.updateHookFromWebview(invalidId, {});
            assert.fail('Should have thrown error for invalid hook ID');
        } catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('not found'));
        }
    });

    test('should generate unique IDs for hooks', async () => {
        const hookData1 = {
            name: 'Hook 1',
            naturalLanguage: 'First hook',
            trigger: 'onDidSaveTextDocument',
            filePattern: '**/*.js'
        };

        const hookData2 = {
            name: 'Hook 2',
            naturalLanguage: 'Second hook',
            trigger: 'onDidSaveTextDocument',
            filePattern: '**/*.ts'
        };

        await hookManager.createHookFromWebview(hookData1);
        await hookManager.createHookFromWebview(hookData2);

        const hooks = hookManager.getHooks();
        assert.strictEqual(hooks.length, 2);
        assert.notStrictEqual(hooks[0].id, hooks[1].id);
    });
});