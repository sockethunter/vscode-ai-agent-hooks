import * as vscode from "vscode";
import { ProviderManager } from "./providers/providerManager";
import { HookManager } from "./hookManager";
import { HookExecutor } from "./hookExecutor";
import { HookManagerProvider } from "./views/hookManagerProvider";
import { StatusBarProvider } from "./views/statusBarProvider";
import { VibeProvider } from "./views/vibeProvider";
import { McpClient } from "./mcp/mcpClient";
import { COMMANDS } from "./constants/commands";

// Global variable to store the Vibe Provider instance
let globalVibeProvider: VibeProvider | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log("🚀 HookFlow - AI Agent Hooks extension is now active!");

  // Initialize managers
  console.log("📋 Initializing managers...");
  const providerManager = ProviderManager.getInstance();
  const hookManager = HookManager.getInstance(context);
  const hookExecutor = HookExecutor.getInstance();
  const mcpClient = McpClient.getInstance();

  // Initialize provider from saved config
  console.log("🔧 Initializing provider from config...");
  providerManager.initializeFromConfig();

  // Wait for hooks to be loaded and registered
  console.log("🔗 Initializing HookManager...");
  await hookManager.initialize();
  console.log("✅ Hook Manager initialized and hooks loaded");

  // Show active hooks count
  const hooks = hookManager.getHooks();
  console.log(`📊 Total hooks loaded: ${hooks.length}`);
  const activeHooks = hooks.filter((h) => h.isActive);
  console.log(`⚡ Active hooks: ${activeHooks.length}`);
  activeHooks.forEach((hook) => {
    console.log(
      `   - ${hook.name} (${hook.trigger}) - Pattern: ${hook.filePattern}`
    );
  });

  // Initialize providers
  console.log("🎨 Initializing providers...");

  try {
    // Status Bar Provider
    console.log("📊 Creating Status Bar Provider...");
    const statusBarProvider = new StatusBarProvider();
    statusBarProvider.initialize(hookManager);
    console.log("✅ Status Bar Provider initialized");

    // Vibe Provider (Chat Window) - Store as global instance
    console.log("💬 Creating Vibe Provider...");
    const vibeProvider = new VibeProvider(context);
    console.log("🔧 Initializing Vibe Provider with managers...");
    vibeProvider.initialize(hookManager, providerManager, mcpClient);
    console.log("✅ Vibe Provider initialized");

    // Store vibeProvider globally for later use in commands
    globalVibeProvider = vibeProvider;

    // Add providers to cleanup
    context.subscriptions.push(statusBarProvider, vibeProvider);
  } catch (error) {
    console.error("❌ Error initializing providers:", error);
    vscode.window.showErrorMessage(
      `HookFlow: Failed to initialize providers - ${error}`
    );
  }

  // Note: HookManagerProvider will be instantiated per webview panel

  // Command to select AI provider
  const selectProviderCommand = vscode.commands.registerCommand(
    COMMANDS.SELECT_PROVIDER,
    async () => {
      await providerManager.selectProvider();
    }
  );

  // Command to test current provider
  const testProviderCommand = vscode.commands.registerCommand(
    COMMANDS.TEST_PROVIDER,
    async () => {
      const provider = providerManager.getCurrentProvider();
      if (!provider) {
        vscode.window.showWarningMessage(
          "No AI provider configured. Please select a provider first."
        );
        return;
      }

      try {
        const response = await provider.sendMessage(
          "Hello, this is a test message."
        );
        vscode.window.showInformationMessage(
          `${provider.getName()} Test successful: ${response.content.substring(
            0,
            50
          )}...`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Provider test failed: ${error}`);
      }
    }
  );

  // Command to open hook manager (creates webview panel)
  const manageHooksCommand = vscode.commands.registerCommand(
    COMMANDS.MANAGE_HOOKS,
    async () => {
      // Create webview panel for hook management
      const panel = vscode.window.createWebviewPanel(
        "hookManager",
        "AI Agent Hook Manager",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [context.extensionUri],
        }
      );

      // Set up the webview content using the provider
      const provider = new HookManagerProvider(context);
      provider.setupWebviewPanel(panel);
    }
  );

  // Command to configure MCP tools
  const configureMcpCommand = vscode.commands.registerCommand(
    "ai-agent-hooks.configureMcp",
    async () => {
      try {
        const toolConfig = await hookManager.getProjectSpecificMcpTools();

        if (toolConfig.available.length === 0) {
          vscode.window.showInformationMessage(
            "No MCP tools available for this project. Make sure you have a workspace open."
          );
          return;
        }

        // Show tool selection with descriptions
        const items = toolConfig.available.map((tool) => ({
          label: tool,
          description: toolConfig.descriptions[tool] || "",
          picked: false, // No pre-selection
        }));

        const selected = await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: "Select MCP tools to enable by default for new hooks",
          title: "Configure MCP Tools",
        });

        if (selected) {
          const selectedTools = selected.map((item) => item.label);
          const config = vscode.workspace.getConfiguration("aiAgentHooks.mcp");

          // Update default tools
          await config.update(
            "defaultTools",
            selectedTools,
            vscode.ConfigurationTarget.Workspace
          );

          // Enable MCP if tools were selected
          if (selectedTools.length > 0) {
            await config.update(
              "enabled",
              true,
              vscode.ConfigurationTarget.Workspace
            );
          }

          vscode.window.showInformationMessage(
            `✅ MCP configuration updated! Default tools: ${selectedTools.join(
              ", "
            )}`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to configure MCP tools: ${error}`
        );
      }
    }
  );

  // Command to show hook status
  const showHookStatusCommand = vscode.commands.registerCommand(
    "ai-agent-hooks.showHookStatus",
    async () => {
      const items = hooks.map((hook) => ({
        label: `${hook.isRunning ? "🔄" : hook.isActive ? "✅" : "❌"} ${
          hook.name
        }`,
        description: `${hook.trigger} | ${hook.filePattern}`,
        detail: hook.description,
      }));

      if (items.length === 0) {
        vscode.window.showInformationMessage("No hooks configured");
        return;
      }

      await vscode.window.showQuickPick(items, {
        placeHolder: "Hook Status Overview",
      });
    }
  );

  // Command for status bar clicks
  const showCommandsCommand = vscode.commands.registerCommand(
    "ai-agent-hooks.showCommands",
    async () => {
      const items = [
        {
          label: "$(gear) Manage Hooks",
          description: "Open the Hook Manager interface",
          command: COMMANDS.MANAGE_HOOKS,
        },
        {
          label: "$(settings-gear) Configure AI Provider",
          description: "Select and configure AI provider",
          command: COMMANDS.SELECT_PROVIDER,
        },
        {
          label: "$(play) Test AI Provider",
          description: "Test current AI provider connection",
          command: COMMANDS.TEST_PROVIDER,
        },
        {
          label: "$(list-unordered) Hook Status",
          description: "View detailed hook status",
          command: "ai-agent-hooks.showHookStatus",
        },
        {
          label: "$(tools) Configure MCP Tools",
          description: "Configure MCP tools for enhanced functionality",
          command: "ai-agent-hooks.configureMcp",
        },
        {
          label: "$(comment-discussion) Open Vibe Mode",
          description: "AI-powered chat interface with project analysis",
          command: "ai-agent-hooks.openVibe",
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Choose an action",
      });

      if (selected) {
        vscode.commands.executeCommand(selected.command);
      }
    }
  );

  // Command to open Vibe Mode (creates webview panel)
  const openVibeCommand = vscode.commands.registerCommand(
    "ai-agent-hooks.openVibe",
    async () => {
      try {
        console.log("🚀 Opening Vibe Mode panel...");
        if (globalVibeProvider) {
          globalVibeProvider.createPanel();
          console.log("✅ Vibe Mode panel created successfully");
        } else {
          console.error("❌ Vibe Provider not found");
          vscode.window.showErrorMessage("Vibe Provider not available");
        }
      } catch (error) {
        console.error("❌ Error opening Vibe Mode:", error);
        vscode.window.showErrorMessage(`Could not open Vibe Mode: ${error}`);
      }
    }
  );

  // Register all commands
  context.subscriptions.push(
    selectProviderCommand,
    testProviderCommand,
    manageHooksCommand,
    configureMcpCommand,
    showHookStatusCommand,
    showCommandsCommand,
    openVibeCommand
  );

  // Clean up on deactivation
  context.subscriptions.push({
    dispose: () => {
      hookExecutor.dispose();
      hookManager.dispose();
    },
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
  const hookExecutor = HookExecutor.getInstance();
  hookExecutor.dispose();

  // Clean up global references
  globalVibeProvider = undefined;
}
