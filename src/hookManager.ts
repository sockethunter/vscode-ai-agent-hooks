import * as vscode from "vscode";
import { HookExecutor } from "./hookExecutor";
import { FileUtils } from "./utils/fileUtils";

export interface Hook {
  id: string;
  name: string;
  description: string;
  trigger: string;
  naturalLanguage: string;
  filePattern: string;
  template: string;
  isActive: boolean;
  isRunning: boolean;
  lastExecuted?: Date;
  createdAt: Date;
}

export class HookManager {
  private static instance: HookManager;
  private hooks: Hook[] = [];
  private context: vscode.ExtensionContext;
  private hookExecutor: HookExecutor;
  private readonly HOOKS_FILE = 'hooks.json';

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.hookExecutor = HookExecutor.getInstance();
    // Load hooks asynchronously
    this.loadHooks().catch(error => {
      console.error("Error during initial hook loading:", error);
    });
  }

  public static getInstance(context?: vscode.ExtensionContext): HookManager {
    if (!HookManager.instance && context) {
      HookManager.instance = new HookManager(context);
    }
    return HookManager.instance;
  }

  public getHooks(): Hook[] {
    return this.hooks;
  }

  // WebView interface methods
  public async createHookFromWebview(data: any): Promise<void> {
    const hook: Hook = {
      id: this.generateId(),
      name: data.name,
      description: data.naturalLanguage,
      trigger: data.trigger,
      naturalLanguage: data.naturalLanguage,
      filePattern: data.filePattern || "**/*", // Default to all files
      template: await this.generateTemplate(data),
      isActive: true,
      isRunning: false,
      createdAt: new Date(),
    };

    this.hooks.push(hook);
    await this.saveHooks();
    
    if (hook.isActive) {
      this.hookExecutor.registerHook(hook);
    }

    vscode.window.showInformationMessage(
      `Hook "${hook.name}" wurde erfolgreich erstellt!`
    );
  }

  public async toggleHookFromWebview(hookId: string): Promise<void> {
    const hook = this.hooks.find((h) => h.id === hookId);
    if (hook) {
      hook.isActive = !hook.isActive;
      
      if (hook.isActive) {
        this.hookExecutor.registerHook(hook);
      } else {
        this.hookExecutor.unregisterHook(hookId);
      }
      
      await this.saveHooks();
    }
  }

  public async deleteHookFromWebview(hookId: string): Promise<void> {
    this.hookExecutor.unregisterHook(hookId);
    this.hooks = this.hooks.filter((h) => h.id !== hookId);
    await this.saveHooks();
  }

  public async stopHookFromWebview(hookId: string): Promise<void> {
    const hook = this.hooks.find((h) => h.id === hookId);
    if (hook) {
      hook.isRunning = false;
      await this.saveHooks();
    }
  }

  public updateHookStatus(hookId: string, isRunning: boolean, lastExecuted?: Date): void {
    const hook = this.hooks.find(h => h.id === hookId);
    if (hook) {
      hook.isRunning = isRunning;
      if (lastExecuted) {
        hook.lastExecuted = lastExecuted;
      }
      this.saveHooks();
    }
  }

  public async executeHook(hook: Hook, context: any): Promise<void> {
    await this.hookExecutor.executeHook(hook, context);
    await this.saveHooks();
  }

  // Private helper methods
  private async generateTemplate(data: any): Promise<string> {
    const template = [
      "// Auto-generated Hook: " + data.name,
      "// Trigger: " + data.trigger,
      "// Description: " + data.naturalLanguage,
      "",
      "export async function execute(context: any) {",
      "  console.log('Hook executed:', '" + data.name + "');",
      "  // TODO: Implement AI-generated logic based on: " + data.naturalLanguage,
      "}"
    ].join("\n");
    
    return template;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
  }

  private getHooksFilePath(): string {
    return FileUtils.getExtensionStoragePath(this.context, this.HOOKS_FILE);
  }

  private async loadHooks(): Promise<void> {
    try {
      const hooksPath = this.getHooksFilePath();
      console.log(`📂 Loading hooks from: ${hooksPath}`);
      
      const data = await FileUtils.readJsonFile<Hook[]>(hooksPath);
      this.hooks = data || [];
      
      console.log(`📋 Loaded ${this.hooks.length} hooks from storage`);
      
      // Register active hooks with executor
      this.hooks.forEach(hook => {
        console.log(`🔄 Processing hook: ${hook.name} - Active: ${hook.isActive}`);
        if (hook.isActive) {
          console.log(`🚀 Registering active hook: ${hook.name}`);
          this.hookExecutor.registerHook(hook);
        } else {
          console.log(`😴 Skipping inactive hook: ${hook.name}`);
        }
      });
      
      console.log(`✅ Hook loading completed. Active hooks registered.`);
    } catch (error) {
      console.error("Error loading hooks:", error);
      this.hooks = [];
    }
  }

  private async saveHooks(): Promise<void> {
    try {
      const hooksPath = this.getHooksFilePath();
      await FileUtils.writeJsonFile(hooksPath, this.hooks);
    } catch (error) {
      console.error("Error saving hooks:", error);
    }
  }

  public dispose(): void {
    // Clean up resources if needed
  }
}