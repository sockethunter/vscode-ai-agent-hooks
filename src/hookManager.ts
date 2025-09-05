import * as vscode from "vscode";
import { HookExecutor } from "./hookExecutor";
import { FileUtils } from "./utils/fileUtils";

export type HookExecutionMode = "multiple" | "single" | "restart";

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
  // Execution control
  executionMode: HookExecutionMode;
  priority: number; // For sequential execution order
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
  private readonly HOOKS_FILE = "hooks.json";

  // Event emitter for status changes
  private _onHookStatusChanged = new vscode.EventEmitter<void>();
  public readonly onHookStatusChanged = this._onHookStatusChanged.event;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.hookExecutor = HookExecutor.getInstance();
  }

  public static getInstance(context?: vscode.ExtensionContext): HookManager {
    if (!HookManager.instance) {
      if (!context) {
        throw new Error(
          "HookManager not initialized. Context required for first initialization."
        );
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
    const config = vscode.workspace.getConfiguration("aiAgentHooks.mcp");
    const mcpEnabled = config.get<boolean>("enabled", false);
    const defaultTools = config.get<string[]>("defaultTools", []);

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
      // Execution control
      executionMode: data.executionMode || "single", // Default to single execution
      priority: data.priority || 0, // Default priority
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
      this._onHookStatusChanged.fire(); // Fire status change event for Vibe Mode
    }
  }

  public async deleteHookFromWebview(hookId: string): Promise<void> {
    this.hookExecutor.unregisterHook(hookId);
    this.hooks = this.hooks.filter((h) => h.id !== hookId);
    await this.saveHooks();
    this.broadcastHookUpdate();
    this._onHookStatusChanged.fire(); // Fire status change event for Vibe Mode
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
    // Update execution control settings if provided
    if (data.executionMode !== undefined) {
      hook.executionMode = data.executionMode;
    }
    if (data.priority !== undefined) {
      hook.priority = data.priority;
    }
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

  public updateHookStatus(
    hookId: string,
    isRunning: boolean,
    lastExecuted?: Date
  ): void {
    console.log(`🔄 Updating hook status: ${hookId} - Running: ${isRunning}`);
    const hook = this.hooks.find((h) => h.id === hookId);
    if (hook) {
      hook.isRunning = isRunning;
      if (lastExecuted) {
        hook.lastExecuted = lastExecuted;
      }
      this.saveHooks();
      this.broadcastHookUpdate();
      this._onHookStatusChanged.fire(); // Fire status change event
      console.log(
        `✅ Hook status updated and broadcast sent for: ${hook.name}`
      );
    } else {
      console.log(`❌ Hook with ID ${hookId} not found`);
    }
  }

  private broadcastHookUpdate(): void {
    // Dynamic import to avoid circular dependencies
    import("./views/hookManagerProvider")
      .then(({ HookManagerProvider }) => {
        HookManagerProvider.broadcastHookUpdate(this.hooks);
      })
      .catch((error) => {
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
      "  // TODO: Implement AI-generated logic based on: " +
        data.naturalLanguage,
      "}",
    ].join("\n");

    return template;
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
    );
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
      this.hooks.forEach((hook) => {
        console.log(
          `🔄 Processing hook: ${hook.name} - Active: ${hook.isActive}`
        );
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
    const config = vscode.workspace.getConfiguration("aiAgentHooks.mcp");
    const allowedTools = config.get<string[]>("allowedTools", []);

    // If no allowed tools configured, return all available tools for this project
    if (allowedTools.length === 0) {
      const workspaceRoot = this.getWorkspaceRoot();
      if (workspaceRoot) {
        const { McpClient } = await import("./mcp/mcpClient");
        const mcpClient = McpClient.getInstance();
        return await mcpClient.getValidatedToolsForProject(workspaceRoot);
      }
      return [];
    }

    return allowedTools;
  }

  public getDefaultMcpTools(): string[] {
    const config = vscode.workspace.getConfiguration("aiAgentHooks.mcp");
    const defaultTools = config.get<string[]>("defaultTools", []);

    // If no default tools configured, return common safe tools
    if (defaultTools.length === 0) {
      return ["mcp_filesystem_list", "mcp_filesystem_read", "mcp_search_find"];
    }

    return defaultTools;
  }

  public isMcpEnabled(): boolean {
    const config = vscode.workspace.getConfiguration("aiAgentHooks.mcp");
    return config.get<boolean>("enabled", false);
  }

  public async getProjectSpecificMcpTools(): Promise<{
    available: string[];
    descriptions: Record<string, string>;
  }> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return { available: [], descriptions: {} };
    }

    const { McpClient } = await import("./mcp/mcpClient");
    const mcpClient = McpClient.getInstance();
    const available = await mcpClient.getValidatedToolsForProject(workspaceRoot);

    // Get descriptions from mcpClient (single source of truth)
    const descriptions: Record<string, string> = {};
    for (const toolName of available) {
      const tool = mcpClient.getRegisteredTool(toolName);
      descriptions[toolName] = tool?.description || `MCP tool: ${toolName}`;
    }

    return {
      available,
      descriptions,
    };
  }

  private getWorkspaceRoot(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return null;
  }

  public async executeMcpToolForChat(
    toolName: string,
    params: any
  ): Promise<any> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace available for MCP tool execution");
    }

    const { McpClient } = await import("./mcp/mcpClient");
    const mcpClient = McpClient.getInstance();

    const allowedTools = await this.getAvailableMcpTools();
    console.log("🔧 Available MCP tools for Vibe Mode:", allowedTools);

    const executionContext = {
      workspaceRoot,
      triggeredFile: "",
      hookId: "vibe-mode-chat",
      allowedTools: allowedTools,
    };

    return await mcpClient.executeTool(toolName, params, executionContext);
  }

  public formatMcpToolResult(toolName: string, result: any): string {
    switch (toolName) {
      case "mcp_filesystem_list":
        if (result && Array.isArray(result)) {
          const files = result
            .filter((item) => item.type === "file")
            .slice(0, 20);
          const dirs = result
            .filter((item) => item.type === "directory")
            .slice(0, 10);
          return `📁 **Directory Contents:**\n**Directories:** ${dirs
            .map((d) => d.name)
            .join(", ")}\n**Files:** ${files.map((f) => f.name).join(", ")}`;
        }
        break;

      case "mcp_filesystem_read":
        if (result && result.content) {
          const preview =
            result.content.length > 500
              ? result.content.substring(0, 500) + "..."
              : result.content;
          return `📄 **File: ${result.path}**\n\`\`\`\n${preview}\n\`\`\``;
        }
        break;

      case "mcp_search_find":
        if (result && result.matches) {
          const matchList = result.matches
            .slice(0, 15)
            .map((path: string) => `• ${path.split("/").pop()}`)
            .join("\n");
          return `🔍 **Found ${result.count} files:**\n${matchList}`;
        }
        break;

      case "mcp_git_status":
        if (result && result.files) {
          if (result.files.length === 0) {
            return `✅ **Git Status:** Working directory clean`;
          }
          const fileList = result.files
            .slice(0, 10)
            .map((file: any) => `• ${file.status} ${file.filename}`)
            .join("\n");
          return `📊 **Git Status:** ${result.files.length} changes\n${fileList}`;
        }
        break;
    }

    return `🔧 **${toolName}:** ${JSON.stringify(result)}`;
  }

  public dispose(): void {
    // Clean up resources if needed
  }
}
