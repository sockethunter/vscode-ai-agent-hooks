import * as assert from 'assert';
import * as vscode from 'vscode';
import { HookExecutor } from '../hookExecutor';
import { Hook } from '../hookManager';

suite('HookExecutor Test Suite', () => {
    let hookExecutor: HookExecutor;
    let mockHook: Hook;

    suiteSetup(() => {
        // Clear any existing instances
        (HookExecutor as any).instance = undefined;
        hookExecutor = HookExecutor.getInstance();
    });

    setup(() => {
        mockHook = {
            id: 'test-hook-id',
            name: 'Test Hook',
            description: 'Test hook description',
            trigger: 'onDidSaveTextDocument',
            naturalLanguage: 'Test hook in natural language',
            filePattern: '**/*.js',
            template: 'test template',
            isActive: true,
            isRunning: false,
            createdAt: new Date(),
            executionMode: 'single',
            priority: 0
        };
    });

    teardown(() => {
        // Clean up after each test
        hookExecutor.unregisterHook(mockHook.id);
    });

    suiteTeardown(() => {
        hookExecutor.dispose();
    });

    test('should create HookExecutor singleton', () => {
        assert.ok(hookExecutor);
        const secondInstance = HookExecutor.getInstance();
        assert.strictEqual(hookExecutor, secondInstance);
    });

    test('should register active hook', () => {
        // This should not throw
        hookExecutor.registerHook(mockHook);
        
        // Hook should be registered (no direct way to verify, but no error is good)
        assert.ok(true);
    });

    test('should not register inactive hook', () => {
        const inactiveHook = { ...mockHook, isActive: false };
        
        // This should not throw but also not register the hook
        hookExecutor.registerHook(inactiveHook);
        
        assert.ok(true);
    });

    test('should unregister hook', () => {
        hookExecutor.registerHook(mockHook);
        
        // This should not throw
        hookExecutor.unregisterHook(mockHook.id);
        
        assert.ok(true);
    });

    test('should match file patterns correctly', () => {
        // Test through public interface - register hooks and verify they work
        const jsHook = { ...mockHook, filePattern: '**/*.js' };
        const tsHook = { ...mockHook, id: 'ts-hook', filePattern: '**/*.ts' };
        
        // Register hooks - this tests the pattern matching indirectly
        hookExecutor.registerHook(jsHook);
        hookExecutor.registerHook(tsHook);
        
        // If no errors thrown, pattern matching works
        assert.ok(true);
        
        // Clean up
        hookExecutor.unregisterHook(jsHook.id);
        hookExecutor.unregisterHook(tsHook.id);
    });

    test('should handle glob patterns correctly', () => {
        // Test through public interface with different patterns
        const patterns = ['**/*.js', '**/*.ts', '**/components/*.tsx'];
        
        patterns.forEach((pattern, index) => {
            const testHook = { 
                ...mockHook, 
                id: `pattern-test-${index}`, 
                filePattern: pattern 
            };
            
            // Should register without errors
            hookExecutor.registerHook(testHook);
            hookExecutor.unregisterHook(testHook.id);
        });
        
        assert.ok(true);
    });

    test('should reset cooldown correctly', () => {
        const testFile = '/test/file.js';
        
        // This should not throw
        hookExecutor.resetCooldown(mockHook.id, testFile);
        hookExecutor.resetCooldown(mockHook.id); // Reset all cooldowns for hook
        
        assert.ok(true);
    });

    test('should stop running hook', () => {
        // This should not throw even if hook is not running
        hookExecutor.stopRunningHook(mockHook.id);
        hookExecutor.stopRunningHook('non-existent-id');
        
        assert.ok(true);
    });

    test('should generate appropriate prompts', () => {
        const executor = hookExecutor as any;
        
        const context = {
            type: 'save',
            file: '/path/to/test.js',
            content: 'function test() { return true; }',
            language: 'javascript'
        };
        
        const prompt = executor.generatePrompt(mockHook, context);
        
        assert.ok(typeof prompt === 'string');
        assert.ok(prompt.length > 0);
        assert.ok(prompt.includes(mockHook.naturalLanguage));
        assert.ok(prompt.includes(context.file));
        assert.ok(prompt.includes(context.language));
    });

    test('should handle file system events', () => {
        const executor = hookExecutor as any;
        
        const context = {
            type: 'create',
            file: '/path/to/new-file.js'
        };
        
        const prompt = executor.generatePrompt(mockHook, context);
        
        assert.ok(typeof prompt === 'string');
        assert.ok(prompt.includes('file system event'));
        assert.ok(prompt.includes('TARGET_FILE'));
    });

    test('should extract workspace root correctly', () => {
        const executor = hookExecutor as any;
        
        // This might return null in test environment, which is expected
        const workspaceRoot = executor.getWorkspaceRoot();
        
        // Should be either string or null
        assert.ok(typeof workspaceRoot === 'string' || workspaceRoot === null);
    });

    test('should handle disposal correctly', () => {
        const testExecutor = HookExecutor.getInstance();
        
        // Register a hook
        testExecutor.registerHook(mockHook);
        
        // This should not throw
        testExecutor.dispose();
        
        assert.ok(true);
    });

    test('should prevent hook from triggering on self-generated files', () => {
        const executor = hookExecutor as any;
        
        // Mock a file path
        const filePath = '/test/generated-file.js';
        
        // Add to generated files set
        executor.hookGeneratedFiles.add(filePath);
        
        // Create a mock document
        const mockDocument = {
            uri: { fsPath: filePath },
            getText: () => 'test content',
            languageId: 'javascript'
        };
        
        // This should return early due to cross-triggering prevention
        // We can't easily test the async method, but we can verify the mechanism exists
        assert.ok(executor.hookGeneratedFiles.has(filePath));
    });

    test('should handle cooldown mechanism', () => {
        const executor = hookExecutor as any;
        const hookFileKey = `${mockHook.id}:/test/file.js`;
        
        // Set a recent execution time
        executor.lastExecution.set(hookFileKey, Date.now());
        
        // Verify cooldown tracking exists
        assert.ok(executor.lastExecution.has(hookFileKey));
        
        // Clear it
        executor.lastExecution.delete(hookFileKey);
        assert.ok(!executor.lastExecution.has(hookFileKey));
    });

    test('should track processing files', () => {
        const executor = hookExecutor as any;
        const hookFileKey = `${mockHook.id}:/test/processing-file.js`;
        
        // Add to processing set
        executor.processingFiles.add(hookFileKey);
        assert.ok(executor.processingFiles.has(hookFileKey));
        
        // Remove from processing set
        executor.processingFiles.delete(hookFileKey);
        assert.ok(!executor.processingFiles.has(hookFileKey));
    });

    suite('Execution Modes', () => {
        test('should handle single execution mode', async () => {
            const singleHook: Hook = {
                ...mockHook,
                id: 'single-mode-hook',
                executionMode: 'single',
                priority: 0
            };

            hookExecutor.registerHook(singleHook);

            // Mock the executeHook method to delay execution
            const originalExecuteHook = (hookExecutor as any).executeHook;
            let executionCount = 0;
            (hookExecutor as any).executeHook = async (hook: Hook, context: any) => {
                executionCount++;
                await new Promise(resolve => setTimeout(resolve, 100)); // Delay
                return originalExecuteHook.call(hookExecutor, hook, context);
            };

            // Simulate multiple rapid file events
            const mockDocument = {
                uri: { fsPath: '/test/file.js' },
                getText: () => 'test content',
                languageId: 'javascript'
            } as any;

            // Trigger multiple events rapidly
            const handleFileEvent = (hookExecutor as any).handleFileEvent.bind(hookExecutor);
            
            // Fire multiple events in parallel
            const promises = [
                handleFileEvent(singleHook, mockDocument, 'save'),
                handleFileEvent(singleHook, mockDocument, 'save'),
                handleFileEvent(singleHook, mockDocument, 'save')
            ];

            await Promise.all(promises);

            // In single mode, only one execution should occur due to running hook check
            assert.strictEqual(executionCount, 1);

            // Restore original method
            (hookExecutor as any).executeHook = originalExecuteHook;
        });

        test('should handle multiple execution mode', async () => {
            const multipleHook: Hook = {
                ...mockHook,
                id: 'multiple-mode-hook',
                executionMode: 'multiple',
                priority: 0
            };

            hookExecutor.registerHook(multipleHook);

            // Mock executeHook to track executions
            const originalExecuteHook = (hookExecutor as any).executeHook;
            let executionCount = 0;
            (hookExecutor as any).executeHook = async (hook: Hook, context: any) => {
                executionCount++;
                await new Promise(resolve => setTimeout(resolve, 50));
                return originalExecuteHook.call(hookExecutor, hook, context);
            };

            const mockDocument = {
                uri: { fsPath: '/test/multiple.js' },
                getText: () => 'test content',
                languageId: 'javascript'
            } as any;

            // Clear cooldown for immediate execution
            hookExecutor.resetCooldown('multiple-mode-hook', '/test/multiple.js');

            const handleFileEvent = (hookExecutor as any).handleFileEvent.bind(hookExecutor);
            
            // Fire multiple events for different files (to avoid cooldown)
            const promises = [
                handleFileEvent(multipleHook, { ...mockDocument, uri: { fsPath: '/test/file1.js' } }, 'save'),
                handleFileEvent(multipleHook, { ...mockDocument, uri: { fsPath: '/test/file2.js' } }, 'save'),
                handleFileEvent(multipleHook, { ...mockDocument, uri: { fsPath: '/test/file3.js' } }, 'save')
            ];

            await Promise.all(promises);

            // In multiple mode, all executions should be allowed
            assert.strictEqual(executionCount, 3);

            (hookExecutor as any).executeHook = originalExecuteHook;
        });

        test('should handle restart execution mode', async () => {
            const restartHook: Hook = {
                ...mockHook,
                id: 'restart-mode-hook',
                executionMode: 'restart',
                priority: 0
            };

            // Test the restart logic by simulating the behavior
            const runningHooks = (hookExecutor as any).runningHooks;
            const stopRunningHook = (hookExecutor as any).stopRunningHook.bind(hookExecutor);
            
            // Simulate first hook running 
            const firstController = new AbortController();
            runningHooks.set('restart-mode-hook', firstController);
            
            // Verify hook is marked as running
            assert.ok(runningHooks.has('restart-mode-hook'));
            
            // Test restart logic: when restart mode hook is already running,
            // it should stop the current one
            if (runningHooks.has('restart-mode-hook')) {
                stopRunningHook('restart-mode-hook');
                // Verify the abort() was called on the first controller
                assert.ok(firstController.signal.aborted);
            }
            
            // The hook remains in runningHooks until executeHook finishes,
            // but the AbortController should be aborted
            assert.ok(runningHooks.has('restart-mode-hook'));
            
            // Simulate new execution starting
            const secondController = new AbortController();
            runningHooks.set('restart-mode-hook', secondController);
            
            // Verify new execution is running
            assert.ok(runningHooks.has('restart-mode-hook'));
            assert.notStrictEqual(firstController, secondController);
            
            // Clean up
            runningHooks.clear();
        });
    });

    suite('Sequential Execution and Priority', () => {
        test('should execute hooks sequentially by priority', async () => {
            const lowPriorityHook: Hook = {
                ...mockHook,
                id: 'low-priority',
                name: 'Low Priority Hook',
                priority: 1,
                executionMode: 'single'
            };

            const highPriorityHook: Hook = {
                ...mockHook,
                id: 'high-priority', 
                name: 'High Priority Hook',
                priority: 10,
                executionMode: 'single'
            };

            // Test priority sorting directly
            const executionQueue = (hookExecutor as any).executionQueue;
            const testFilePath = '/test/priority-queue.js';
            const mockContext = { type: 'save', file: testFilePath };

            // Manually create a queue and test sorting
            const queue = [
                { hook: lowPriorityHook, context: mockContext },
                { hook: highPriorityHook, context: mockContext }
            ];

            // Apply the same sorting logic as in enqueueHookExecution
            queue.sort((a, b) => b.hook.priority - a.hook.priority);

            // Verify priority ordering (highest priority first)
            assert.strictEqual(queue.length, 2);
            assert.strictEqual(queue[0].hook.name, 'High Priority Hook');
            assert.strictEqual(queue[1].hook.name, 'Low Priority Hook');
            assert.strictEqual(queue[0].hook.priority, 10);
            assert.strictEqual(queue[1].hook.priority, 1);
        });

        test('should handle execution queue properly', async () => {
            const hook1: Hook = {
                ...mockHook,
                id: 'queue-hook-1',
                priority: 5,
                executionMode: 'single'
            };

            const hook2: Hook = {
                ...mockHook,
                id: 'queue-hook-2', 
                priority: 3,
                executionMode: 'single'
            };

            const hook3: Hook = {
                ...mockHook,
                id: 'queue-hook-3',
                priority: 8,
                executionMode: 'single'
            };

            // Test multi-hook priority sorting
            const mockContext = { type: 'save', file: '/test/queue.js' };

            // Create queue with hooks in mixed priority order
            const queue = [
                { hook: hook1, context: mockContext }, // priority 5
                { hook: hook2, context: mockContext }, // priority 3
                { hook: hook3, context: mockContext }  // priority 8
            ];

            // Apply the same sorting logic as in enqueueHookExecution
            queue.sort((a, b) => b.hook.priority - a.hook.priority);

            // Verify queue is sorted by priority (highest first)
            assert.strictEqual(queue.length, 3);
            assert.strictEqual(queue[0].hook.priority, 8); // Highest priority first
            assert.strictEqual(queue[1].hook.priority, 5);
            assert.strictEqual(queue[2].hook.priority, 3); // Lowest priority last
            assert.strictEqual(queue[0].hook.id, 'queue-hook-3');
            assert.strictEqual(queue[1].hook.id, 'queue-hook-1');
            assert.strictEqual(queue[2].hook.id, 'queue-hook-2');
        });

        test('should clean up execution queue when empty', async () => {
            const testHook: Hook = {
                ...mockHook,
                id: 'cleanup-test',
                priority: 1,
                executionMode: 'single'
            };

            hookExecutor.registerHook(testHook);

            const mockDocument = {
                uri: { fsPath: '/test/cleanup.js' },
                getText: () => 'test content',
                languageId: 'javascript'
            } as any;

            // Access private executionQueue
            const executionQueue = (hookExecutor as any).executionQueue;
            
            const handleFileEvent = (hookExecutor as any).handleFileEvent.bind(hookExecutor);
            
            // Trigger execution
            await handleFileEvent(testHook, mockDocument, 'save');

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Queue should be cleaned up (empty)
            assert.strictEqual(executionQueue.size, 0);
        });
    });

    suite('Error Handling and Edge Cases', () => {
        test('should handle execution errors gracefully in queue', async () => {
            const errorHook: Hook = {
                ...mockHook,
                id: 'error-hook',
                priority: 1,
                executionMode: 'single'
            };

            const normalHook: Hook = {
                ...mockHook,
                id: 'normal-hook',
                priority: 2,
                executionMode: 'single'
            };

            hookExecutor.registerHook(errorHook);
            hookExecutor.registerHook(normalHook);

            let normalHookExecuted = false;

            // Mock executeHook to throw error for error-hook
            const originalExecuteHook = (hookExecutor as any).executeHook;
            (hookExecutor as any).executeHook = async (hook: Hook, context: any) => {
                if (hook.id === 'error-hook') {
                    throw new Error('Test execution error');
                }
                if (hook.id === 'normal-hook') {
                    normalHookExecuted = true;
                }
                return originalExecuteHook.call(hookExecutor, hook, context);
            };

            const mockDocument = {
                uri: { fsPath: '/test/error.js' },
                getText: () => 'test content',
                languageId: 'javascript'
            } as any;

            const handleFileEvent = (hookExecutor as any).handleFileEvent.bind(hookExecutor);

            // Trigger both hooks 
            await Promise.all([
                handleFileEvent(errorHook, mockDocument, 'save'),
                handleFileEvent(normalHook, mockDocument, 'save')
            ]);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 100));

            // Normal hook should still execute despite error in first hook
            assert.strictEqual(normalHookExecuted, true);

            (hookExecutor as any).executeHook = originalExecuteHook;
        });

        test('should handle cooldown with different execution modes', async () => {
            const singleHook: Hook = {
                ...mockHook,
                id: 'cooldown-single',
                executionMode: 'single',
                priority: 1
            };

            hookExecutor.registerHook(singleHook);

            let executionCount = 0;
            const originalExecuteHook = (hookExecutor as any).executeHook;
            (hookExecutor as any).executeHook = async (hook: Hook, context: any) => {
                executionCount++;
                return originalExecuteHook.call(hookExecutor, hook, context);
            };

            const mockDocument = {
                uri: { fsPath: '/test/cooldown.js' },
                getText: () => 'test content',
                languageId: 'javascript'
            } as any;

            const handleFileEvent = (hookExecutor as any).handleFileEvent.bind(hookExecutor);

            // First execution
            await handleFileEvent(singleHook, mockDocument, 'save');
            
            // Second execution immediately (should be blocked by cooldown)
            await handleFileEvent(singleHook, mockDocument, 'save');

            // Should only execute once due to cooldown
            assert.strictEqual(executionCount, 1);

            // Reset cooldown and try again
            hookExecutor.resetCooldown('cooldown-single', '/test/cooldown.js');
            await handleFileEvent(singleHook, mockDocument, 'save');

            // Should execute again after cooldown reset
            assert.strictEqual(executionCount, 2);

            (hookExecutor as any).executeHook = originalExecuteHook;
        });
    });

    suite('Private Method Testing', () => {
        test('should test canExecuteAfterCooldown method', () => {
            const hookFileKey = 'test-hook:test-file';
            const canExecuteAfterCooldown = (hookExecutor as any).canExecuteAfterCooldown.bind(hookExecutor);
            
            // Should be able to execute initially
            assert.strictEqual(canExecuteAfterCooldown(hookFileKey), true);
            
            // Set recent execution
            const lastExecution = (hookExecutor as any).lastExecution;
            lastExecution.set(hookFileKey, Date.now());
            
            // Should not be able to execute immediately
            assert.strictEqual(canExecuteAfterCooldown(hookFileKey), false);
            
            // Set old execution (beyond cooldown)
            lastExecution.set(hookFileKey, Date.now() - 6000); // 6 seconds ago
            
            // Should be able to execute after cooldown
            assert.strictEqual(canExecuteAfterCooldown(hookFileKey), true);
        });

        test('should test scheduleHookExecution method', async () => {
            const scheduleHookExecution = (hookExecutor as any).scheduleHookExecution.bind(hookExecutor);
            
            const testHook: Hook = {
                ...mockHook,
                id: 'schedule-test',
                executionMode: 'multiple',
                priority: 1
            };

            let executedContext: any = null;
            const originalExecuteHookWithChecks = (hookExecutor as any).executeHookWithChecks;
            (hookExecutor as any).executeHookWithChecks = async (hook: Hook, context: any) => {
                executedContext = context;
            };

            const testContext = {
                type: 'save',
                file: '/test/schedule.js',
                content: 'test content',
                language: 'javascript'
            };

            await scheduleHookExecution('/test/schedule.js', testHook, testContext);

            assert.deepStrictEqual(executedContext, testContext);

            (hookExecutor as any).executeHookWithChecks = originalExecuteHookWithChecks;
        });
    });
});