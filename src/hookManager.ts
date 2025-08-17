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
  // MCP Configuration
  mcpEnabled?: boolean;
  allowedMcpTools?: string[];
  multiStepEnabled?: boolean;
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
  }

  public static getInstance(context?: vscode.ExtensionContext): HookManager {
    if (!HookManager.instance) {
      if (!context) {
        throw new Error("HookManager not initialized. Context required for first initialization.");
      }
      HookManager.instance = new HookManager(context);
    }
    return HookManager.instance;
  }

  public async initialize(): Promise<void> {
    console.log("🚀 Initializing HookManager...");
    
    // Ensure storage directory exists
    const storagePath = this.context.globalStorageUri.fsPath;
    console.log(`📁 Extension storage path: ${storagePath}`);
    await FileUtils.ensureDirectoryExists(storagePath);
    
    const hooksFilePath = this.getHooksFilePath();
    console.log(`📁 Hooks file path: ${hooksFilePath}`);
    
    await this.loadHooks();
    console.log("✅ HookManager initialization completed");
  }

  public getHooks(): Hook[] {
    return this.hooks;
  }

  // WebView interface methods
  public async createHookFromWebview(data: any): Promise<void> {
    // Get MCP configuration from settings
    const config = vscode.workspace.getConfiguration('aiAgentHooks.mcp');
    const mcpEnabled = config.get<boolean>('enabled', false);
    const defaultTools = config.get<string[]>('defaultTools', []);

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
      // MCP Configuration
      mcpEnabled: data.mcpEnabled || mcpEnabled,
      allowedMcpTools: data.allowedMcpTools || defaultTools,
      multiStepEnabled: data.multiStepEnabled || false,
    };

    this.hooks.push(hook);
    await this.saveHooks();
    
    if (hook.isActive) {
      this.hookExecutor.registerHook(hook);
    }

    this.broadcastHookUpdate();
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
      this.broadcastHookUpdate();
    }
  }

  public async deleteHookFromWebview(hookId: string): Promise<void> {
    this.hookExecutor.unregisterHook(hookId);
    this.hooks = this.hooks.filter((h) => h.id !== hookId);
    await this.saveHooks();
    this.broadcastHookUpdate();
  }

  public async stopHookFromWebview(hookId: string): Promise<void> {
    console.log(`⏹️ Stop request for hook: ${hookId}`);
    const hook = this.hooks.find((h) => h.id === hookId);
    if (hook) {
      // Stop the actual execution in HookExecutor
      this.hookExecutor.stopRunningHook(hookId);
      
      // Update status
      hook.isRunning = false;
      await this.saveHooks();
      this.broadcastHookUpdate();
      
      vscode.window.showInformationMessage(
        `⏹️ Hook "${hook.name}" stop requested`
      );
    }
  }

  public async updateHookFromWebview(hookId: string, data: any): Promise<void> {
    const hook = this.hooks.find((h) => h.id === hookId);
    if (!hook) {
      throw new Error(`Hook with ID ${hookId} not found`);
    }

    // Unregister old hook first
    this.hookExecutor.unregisterHook(hookId);

    // Update hook properties
    hook.name = data.name;
    hook.description = data.naturalLanguage;
    hook.naturalLanguage = data.naturalLanguage;
    hook.trigger = data.trigger;
    hook.filePattern = data.filePattern || "**/*";
    hook.template = await this.generateTemplate(data);
    // Update MCP settings if provided
    if (data.mcpEnabled !== undefined) {
      hook.mcpEnabled = data.mcpEnabled;
    }
    if (data.allowedMcpTools !== undefined) {
      hook.allowedMcpTools = data.allowedMcpTools;
    }
    if (data.multiStepEnabled !== undefined) {
      hook.multiStepEnabled = data.multiStepEnabled;
    }

    await this.saveHooks();

    // Re-register if active
    if (hook.isActive) {
      this.hookExecutor.registerHook(hook);
    }

    this.broadcastHookUpdate();
    vscode.window.showInformationMessage(
      `Hook "${hook.name}" wurde erfolgreich aktualisiert!`
    );
  }

  public updateHookStatus(hookId: string, isRunning: boolean, lastExecuted?: Date): void {
    console.log(`🔄 Updating hook status: ${hookId} - Running: ${isRunning}`);
    const hook = this.hooks.find(h => h.id === hookId);
    if (hook) {
      hook.isRunning = isRunning;
      if (lastExecuted) {
        hook.lastExecuted = lastExecuted;
      }
      this.saveHooks();
      this.broadcastHookUpdate();
      console.log(`✅ Hook status updated and broadcast sent for: ${hook.name}`);
    } else {
      console.log(`❌ Hook with ID ${hookId} not found`);
    }
  }

  private broadcastHookUpdate(): void {
    // Dynamic import to avoid circular dependencies
    import("./views/hookManagerProvider").then(({ HookManagerProvider }) => {
      HookManagerProvider.broadcastHookUpdate(this.hooks);
    }).catch(error => {
      console.error("Error broadcasting hook update:", error);
    });
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

  public async getAvailableMcpTools(): Promise<string[]> {
    const config = vscode.workspace.getConfiguration('aiAgentHooks.mcp');
    const allowedTools = config.get<string[]>('allowedTools', []);
    
    // If no allowed tools configured, return all available tools for this project
    if (allowedTools.length === 0) {
      const workspaceRoot = this.getWorkspaceRoot();
      if (workspaceRoot) {
        const { McpClient } = await import('./mcp/mcpClient');
        const mcpClient = McpClient.getInstance();
        return await mcpClient.getValidatedToolsForProject(workspaceRoot);
      }
      return [];
    }
    
    return allowedTools;
  }

  public getDefaultMcpTools(): string[] {
    const config = vscode.workspace.getConfiguration('aiAgentHooks.mcp');
    const defaultTools = config.get<string[]>('defaultTools', []);
    
    // If no default tools configured, return common safe tools
    if (defaultTools.length === 0) {
      return [
        'mcp_filesystem_list',
        'mcp_filesystem_read',
        'mcp_search_find'
      ];
    }
    
    return defaultTools;
  }

  public isMcpEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('aiAgentHooks.mcp');
    return config.get<boolean>('enabled', false);
  }

  public async getProjectSpecificMcpTools(): Promise<{
    available: string[];
    recommended: string[];
    descriptions: Record<string, string>;
  }> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return { available: [], recommended: [], descriptions: {} };
    }

    const { McpClient } = await import('./mcp/mcpClient');
    const mcpClient = McpClient.getInstance();
    const available = await mcpClient.getValidatedToolsForProject(workspaceRoot);
    
    // Recommend tools based on project structure
    const recommended: string[] = [];
    const fs = require('fs').promises;
    const path = require('path');

    try {
      // Always recommend basic tools
      recommended.push('mcp_filesystem_list', 'mcp_filesystem_read');
      
      // Check for Git repository
      try {
        await fs.access(path.join(workspaceRoot, '.git'));
        recommended.push('mcp_git_status', 'mcp_git_log');
      } catch {}
      
      // Check for package.json (Node.js project)
      try {
        await fs.access(path.join(workspaceRoot, 'package.json'));
        recommended.push('mcp_search_find', 'mcp_search_grep');
      } catch {}
      
    } catch {}

    const descriptions = {
      'mcp_filesystem_list': 'List directory contents and explore project structure',
      'mcp_filesystem_read': 'Read single file contents',
      'mcp_filesystem_read_multiple': 'Read multiple files simultaneously for comparison',
      'mcp_search_find': 'Find files by name patterns (glob matching)',
      'mcp_search_grep': 'Search for text patterns across files',
      'mcp_git_status': 'Get current Git repository status',
      'mcp_git_log': 'View Git commit history'
    };

    return {
      available: available.filter(tool => recommended.includes(tool) || available.includes(tool)),
      recommended: recommended.filter(tool => available.includes(tool)),
      descriptions
    };
  }

  private getWorkspaceRoot(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return null;
  }

  public dispose(): void {
    // Clean up resources if needed
  }
}