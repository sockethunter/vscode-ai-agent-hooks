import * as vscode from 'vscode';
import { HookManager } from '../hookManager';

export class StatusBarProvider implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private hookManager: HookManager | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100 // Priority - higher numbers appear more to the left
        );
        
        this.statusBarItem.command = 'ai-agent-hooks.showCommands';
        this.statusBarItem.tooltip = 'HookFlow - AI Agent Hooks';
        
        this.updateStatus();
        this.statusBarItem.show();
    }

    public initialize(hookManager: HookManager): void {
        this.hookManager = hookManager;
        this.updateStatus();
        
        // Listen for hook status changes
        this.disposables.push(
            hookManager.onHookStatusChanged(() => {
                this.updateStatus();
            })
        );
    }

    private updateStatus(): void {
        if (!this.hookManager) {
            this.statusBarItem.text = '$(rocket) HookFlow';
            this.statusBarItem.backgroundColor = undefined;
            return;
        }

        const hooks = this.hookManager.getHooks();
        const activeHooks = hooks.filter(h => h.isActive);
        const runningHooks = hooks.filter(h => h.isRunning);
        
        if (runningHooks.length > 0) {
            // Hooks are currently running
            this.statusBarItem.text = `$(sync~spin) HookFlow (${runningHooks.length} running)`;
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
        } else if (activeHooks.length > 0) {
            // Hooks are active but not running
            this.statusBarItem.text = `$(rocket) HookFlow (${activeHooks.length} active)`;
            this.statusBarItem.backgroundColor = undefined;
        } else if (hooks.length > 0) {
            // Hooks exist but are inactive
            this.statusBarItem.text = `$(circle-slash) HookFlow (${hooks.length} inactive)`;
            this.statusBarItem.backgroundColor = undefined;
        } else {
            // No hooks
            this.statusBarItem.text = '$(rocket) HookFlow';
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    public dispose(): void {
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}