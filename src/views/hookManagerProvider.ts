import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class HookManagerProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "hookManager";
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    webviewView.webview.html = this.getHtmlForWebview();
    this.setupMessageHandling(webviewView.webview);
  }

  private getHtmlForWebview(): string {
    try {
      // Load HTML template
      const templatePath = path.join(
        this.context.extensionPath,
        "src/webview/templates/hookManager.html"
      );
      console.log(`📄 Loading HTML template from: ${templatePath}`);

      let html = fs.readFileSync(templatePath, "utf8");

      // Load CSS and JS assets
      const cssContent = this.loadAsset("hookManager.css");
      const jsContent = this.loadAsset("hookManager.js");

      // Replace template placeholders with inline content
      html = html.replace(
        '<link rel="stylesheet" href="{{cssPath}}">',
        `<style>${cssContent}</style>`
      );
      html = html.replace(
        '<script src="{{scriptPath}}"></script>',
        `<script>console.log('Hook Manager script loaded');\n${jsContent}</script>`
      );

      console.log(`✅ HTML template processed successfully`);
      return html;
    } catch (error) {
      console.error("Error loading HTML template:", error);
      return this.getFallbackHtml();
    }
  }

  private loadAsset(fileName: string): string {
    try {
      const assetPath = path.join(
        this.context.extensionPath,
        "src/webview/assets",
        fileName
      );
      return fs.readFileSync(assetPath, "utf8");
    } catch (error) {
      console.error(`Error loading asset ${fileName}:`, error);
      return `/* Error loading ${fileName} */`;
    }
  }

  private getFallbackHtml(): string {
    console.log(`⚠️ Using fallback HTML - template files not found`);

    return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
            <title>Hook Manager (Fallback)</title>
            <style>
                body { 
                    font-family: var(--vscode-font-family); 
                    padding: 20px; 
                    background-color: var(--vscode-editor-background); 
                    color: var(--vscode-editor-foreground); 
                }
                .error { 
                    padding: 20px; 
                    background-color: var(--vscode-errorBackground); 
                    border: 1px solid var(--vscode-errorBorder); 
                    border-radius: 4px;
                    margin-bottom: 20px;
                }
                .form-group { margin-bottom: 15px; }
                label { display: block; margin-bottom: 5px; font-weight: bold; }
                input, textarea, select { 
                    width: 100%; padding: 8px; margin: 5px 0; 
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    box-sizing: border-box;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="error">
                <h1>🔗 Hook Manager (Fallback Mode)</h1>
                <p><strong>⚠️ Could not load template files.</strong></p>
                <p>Expected paths:</p>
                <ul>
                    <li>src/webview/templates/hookManager.html</li>
                    <li>src/webview/assets/hookManager.css</li>
                    <li>src/webview/assets/hookManager.js</li>
                </ul>
                <p>Fallback interface available:</p>
            </div>
            
            <div class="form-group">
                <label for="hookName">Hook Name:</label>
                <input type="text" id="hookName" placeholder="Test Hook" required>
            </div>
            <div class="form-group">
                <label for="naturalLanguage">Description:</label>
                <textarea id="naturalLanguage" placeholder="Test description" required></textarea>
            </div>
            <div class="form-group">
                <label for="trigger">Trigger:</label>
                <select id="trigger">
                    <option value="onDidSaveTextDocument" selected>File saved</option>
                    <option value="onDidChangeTextDocument">File changed</option>
                    <option value="onDidOpenTextDocument">File opened</option>
                </select>
            </div>
            <button onclick="createTestHook()">🚀 Create Test Hook</button>
            
            <script>
                console.log('🔄 Fallback Hook Manager loaded');
                const vscode = acquireVsCodeApi();
                
                function createTestHook() {
                    const name = document.getElementById('hookName').value;
                    const description = document.getElementById('naturalLanguage').value;
                    const trigger = document.getElementById('trigger').value;
                    
                    if (!name || !description) {
                        alert('Please enter name and description!');
                        return;
                    }
                    
                    console.log('🚀 Creating fallback test hook...', { name, description, trigger });
                    vscode.postMessage({
                        command: 'createHook',
                        data: {
                            name: name,
                            naturalLanguage: description,
                            trigger: trigger,
                            filePattern: '**/*'
                        }
                    });
                    
                    // Reset form
                    document.getElementById('hookName').value = '';
                    document.getElementById('naturalLanguage').value = '';
                }
            </script>
        </body>
        </html>`;
  }

  private setupMessageHandling(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message) => {
        console.log("Received message in provider:", message);

        try {
          switch (message.command) {
            case "createHook":
              await this.handleCreateHook(message.data);
              break;
            case "getHooks":
              await this.handleGetHooks();
              break;
            case "toggleHook":
              await this.handleToggleHook(message.hookId);
              break;
            case "deleteHook":
              await this.handleDeleteHook(message.hookId);
              break;
            case "stopHook":
              await this.handleStopHook(message.hookId);
              break;
            default:
              console.log("Unknown command:", message.command);
          }
        } catch (error) {
          console.error("Error handling message:", error);
          this.postMessage({
            command: "error",
            message: `Error: ${error}`,
          });
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  private async handleCreateHook(data: any) {
    console.log("Creating hook with data:", data);

    try {
      // Dynamic import to avoid circular dependencies
      const { HookManager } = await import("../hookManager");
      const hookManager = HookManager.getInstance(this.context);

      await hookManager.createHookFromWebview(data);

      this.postMessage({
        command: "hookCreated",
        success: true,
      });

      // Refresh hooks list
      await this.handleGetHooks();
    } catch (error) {
      console.error("Error creating hook:", error);
      this.postMessage({
        command: "error",
        message: `Error creating hook: ${error}`,
      });
    }
  }

  private async handleGetHooks() {
    try {
      const { HookManager } = await import("../hookManager");
      const hookManager = HookManager.getInstance(this.context);
      const hooks = hookManager.getHooks();

      console.log("Sending hooks to webview:", hooks);

      this.postMessage({
        command: "updateHooks",
        hooks: hooks,
      });
    } catch (error) {
      console.error("Error getting hooks:", error);
    }
  }

  private async handleToggleHook(hookId: string) {
    try {
      const { HookManager } = await import("../hookManager");
      const hookManager = HookManager.getInstance(this.context);
      await hookManager.toggleHookFromWebview(hookId);

      await this.handleGetHooks();
    } catch (error) {
      this.postMessage({
        command: "error",
        message: `Error toggling hook: ${error}`,
      });
    }
  }

  private async handleDeleteHook(hookId: string) {
    try {
      const { HookManager } = await import("../hookManager");
      const hookManager = HookManager.getInstance(this.context);
      await hookManager.deleteHookFromWebview(hookId);

      await this.handleGetHooks();
    } catch (error) {
      this.postMessage({
        command: "error",
        message: `Error deleting hook: ${error}`,
      });
    }
  }

  private async handleStopHook(hookId: string) {
    try {
      const { HookManager } = await import("../hookManager");
      const hookManager = HookManager.getInstance(this.context);
      await hookManager.stopHookFromWebview(hookId);

      await this.handleGetHooks();
    } catch (error) {
      this.postMessage({
        command: "error",
        message: `Error stopping hook: ${error}`,
      });
    }
  }

  private postMessage(message: any) {
    if (this._view) {
      console.log("Posting message to webview:", message);
      this._view.webview.postMessage(message);
    } else {
      console.log("No webview available to post message");
    }
  }

  public updateHooks() {
    this.handleGetHooks();
  }
}
