import * as vscode from "vscode";
import { ProviderManager } from "./providers/providerManager";
import { HookManager } from "./hookManager";
import { HookExecutor } from "./hookExecutor";
import { HookManagerProvider } from "./views/hookManagerProvider";
import { COMMANDS } from "./constants/commands";

export function activate(context: vscode.ExtensionContext) {
  console.log("AI Agent Hooks extension is now active!");

  // Initialize managers
  const providerManager = ProviderManager.getInstance();
  const hookManager = HookManager.getInstance(context);
  const hookExecutor = HookExecutor.getInstance();

  // Initialize provider from saved config
  providerManager.initializeFromConfig();

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
      const mockWebviewView = {
        webview: panel.webview,
        onDidDispose: panel.onDidDispose,
        onDidChangeVisibility: panel.onDidChangeViewState,
        visible: true,
        show: () => panel.reveal(),
        title: "Hook Manager",
      } as any;

      provider.resolveWebviewView(mockWebviewView, {} as any, {} as any);
    }
  );

  // Register all commands
  context.subscriptions.push(
    selectProviderCommand,
    testProviderCommand,
    manageHooksCommand
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
}
