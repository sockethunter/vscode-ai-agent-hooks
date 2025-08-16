import * as vscode from "vscode";
import { Hook } from "./hookManager";
import { ProviderManager } from "./providers/providerManager";
import { TemplateEngine } from "./templates/hookTemplates";

export class HookExecutor {
  private static instance: HookExecutor;
  private providerManager: ProviderManager;
  private fileWatchers: Map<string, vscode.FileSystemWatcher[]> = new Map();
  private lastExecution: Map<string, number> = new Map(); // Track last execution time per file
  private readonly COOLDOWN_MS = 5000; // 5 seconds cooldown
  private processingFiles: Set<string> = new Set(); // Track files currently being processed

  private constructor() {
    this.providerManager = ProviderManager.getInstance();
  }

  public static getInstance(): HookExecutor {
    if (!HookExecutor.instance) {
      HookExecutor.instance = new HookExecutor();
    }
    return HookExecutor.instance;
  }

  public registerHook(hook: Hook): void {
    console.log(
      `🔧 Registering hook: ${hook.name} (${hook.id}) - Active: ${hook.isActive}, Trigger: ${hook.trigger}`
    );

    if (!hook.isActive) {
      console.log(`❌ Hook ${hook.name} is not active, skipping registration`);
      return;
    }

    // Dispose existing watchers for this hook
    this.disposeHookWatchers(hook.id);

    const watchers: vscode.FileSystemWatcher[] = [];

    switch (hook.trigger) {
      case "onDidSaveTextDocument":
        console.log(
          `📁 Setting up onDidSaveTextDocument listener for hook: ${hook.name}`
        );
        const saveDisposable = vscode.workspace.onDidSaveTextDocument(
          (document) => {
            console.log(
              `💾 File saved: ${document.fileName}, checking hook: ${hook.name}`
            );
            this.handleFileEvent(hook, document, "save");
          }
        );
        // Store as a pseudo-watcher
        watchers.push(saveDisposable as any);
        console.log(
          `✅ onDidSaveTextDocument listener registered for hook: ${hook.name}`
        );
        break;

      case "onDidChangeTextDocument":
        console.log(
          `📝 Setting up onDidChangeTextDocument listener for hook: ${hook.name}`
        );
        const changeDisposable = vscode.workspace.onDidChangeTextDocument(
          (event) => {
            console.log(
              `📝 File changed: ${event.document.fileName}, checking hook: ${hook.name}`
            );
            this.handleFileEvent(hook, event.document, "change");
          }
        );
        watchers.push(changeDisposable as any);
        console.log(
          `✅ onDidChangeTextDocument listener registered for hook: ${hook.name}`
        );
        break;

      case "onDidOpenTextDocument":
        console.log(
          `📂 Setting up onDidOpenTextDocument listener for hook: ${hook.name}`
        );
        const openDisposable = vscode.workspace.onDidOpenTextDocument(
          (document) => {
            console.log(
              `📂 File opened: ${document.fileName}, checking hook: ${hook.name}`
            );
            this.handleFileEvent(hook, document, "open");
          }
        );
        watchers.push(openDisposable as any);
        console.log(
          `✅ onDidOpenTextDocument listener registered for hook: ${hook.name}`
        );
        break;

      case "onDidCreateFiles":
        const createWatcher = vscode.workspace.createFileSystemWatcher("**/*");
        createWatcher.onDidCreate((uri) =>
          this.handleFileSystemEvent(hook, uri, "create")
        );
        watchers.push(createWatcher);
        break;

      case "onDidDeleteFiles":
        const deleteWatcher = vscode.workspace.createFileSystemWatcher("**/*");
        deleteWatcher.onDidDelete((uri) =>
          this.handleFileSystemEvent(hook, uri, "delete")
        );
        watchers.push(deleteWatcher);
        break;
    }

    this.fileWatchers.set(hook.id, watchers);
  }

  public unregisterHook(hookId: string): void {
    this.disposeHookWatchers(hookId);
  }

  private disposeHookWatchers(hookId: string): void {
    const watchers = this.fileWatchers.get(hookId);
    if (watchers) {
      watchers.forEach((watcher) => watcher.dispose());
      this.fileWatchers.delete(hookId);
    }
  }

  private async handleFileEvent(
    hook: Hook,
    document: vscode.TextDocument,
    eventType: string
  ): Promise<void> {
    const filePath = document.uri.fsPath;
    const hookFileKey = `${hook.id}:${filePath}`;

    console.log(
      `🎯 handleFileEvent called for hook: ${hook.name}, file: ${filePath}, event: ${eventType}`
    );

    // Prevent recursion: check if file is already being processed
    if (this.processingFiles.has(hookFileKey)) {
      console.log(
        `🔄 File ${filePath} is already being processed by hook ${hook.name}, skipping`
      );
      return;
    }

    // Cooldown check
    const lastExecTime = this.lastExecution.get(hookFileKey) || 0;
    const now = Date.now();
    const timeSinceLastExec = now - lastExecTime;

    if (timeSinceLastExec < this.COOLDOWN_MS) {
      const remainingCooldown = this.COOLDOWN_MS - timeSinceLastExec;
      console.log(
        `⏳ Hook ${hook.name} is on cooldown for file ${filePath}. ${remainingCooldown}ms remaining`
      );
      return;
    }

    const matches = this.matchesFilePattern(filePath, hook);
    console.log(
      `🔍 File pattern match result: ${matches} for hook: ${hook.name}`
    );

    if (!matches) {
      console.log(
        `❌ File pattern doesn't match for hook: ${hook.name}, skipping execution`
      );
      return;
    }

    console.log(`🚀 Executing hook: ${hook.name} for file: ${filePath}`);

    // Mark file as processing
    this.processingFiles.add(hookFileKey);

    try {
      // Update last execution time
      this.lastExecution.set(hookFileKey, now);

      await this.executeHook(hook, {
        type: eventType,
        file: filePath,
        content: document.getText(),
        language: document.languageId,
      });
    } finally {
      this.processingFiles.delete(hookFileKey);
    }
  }

  private async handleFileSystemEvent(
    hook: Hook,
    uri: vscode.Uri,
    eventType: string
  ): Promise<void> {
    if (!this.matchesFilePattern(uri.fsPath, hook)) {
      return;
    }

    await this.executeHook(hook, {
      type: eventType,
      file: uri.fsPath,
    });
  }

  private matchesFilePattern(filePath: string, hook: Hook): boolean {
    console.log(
      `🔍 Checking file pattern for: ${filePath} against hook: ${hook.name}`
    );
    console.log(`🎯 Hook filePattern: "${hook.filePattern}"`);

    // Default to match all files if no pattern specified
    if (!hook.filePattern || hook.filePattern === "**/*") {
      console.log(`✅ No specific pattern, matching all files`);
      return true;
    }

    // Split multiple patterns by comma and trim
    const patterns = hook.filePattern.split(',').map(p => p.trim());
    
    for (const pattern of patterns) {
      if (this.matchesGlobPattern(filePath, pattern)) {
        console.log(`✅ File matches pattern: ${pattern}`);
        return true;
      }
    }

    console.log(`❌ File doesn't match any pattern in: ${hook.filePattern}`);
    return false;
  }

  private matchesGlobPattern(filePath: string, pattern: string): boolean {
    // Simple glob matching implementation
    // Convert glob pattern to regex
    
    // Normalize paths (use forward slashes)
    const normalizedPath = filePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');
    
    console.log(`🔍 Matching path: ${normalizedPath} against pattern: ${normalizedPattern}`);
    
    // Handle simple patterns first
    if (normalizedPattern === "**/*") {
      return true; // Match everything
    }
    
    // Convert glob to regex
    let regexPattern = normalizedPattern
      .replace(/\*\*/g, '.*')  // ** matches any directory depth
      .replace(/\*/g, '[^/]*') // * matches any file/directory name (but not /)
      .replace(/\?/g, '[^/]')  // ? matches single character (but not /)
      .replace(/\./g, '\\.');  // Escape dots
    
    // Ensure the pattern matches the end of the path
    if (!regexPattern.startsWith('.*')) {
      regexPattern = '.*' + regexPattern;
    }
    if (!regexPattern.endsWith('$')) {
      regexPattern = regexPattern + '$';
    }
    
    const regex = new RegExp(regexPattern, 'i'); // Case insensitive
    const matches = regex.test(normalizedPath);
    
    console.log(`🔍 Regex: ${regexPattern}, Result: ${matches}`);
    return matches;
  }

  public async executeHook(hook: Hook, context: any): Promise<void> {
    try {
      hook.isRunning = true;
      hook.lastExecuted = new Date();

      vscode.window.showInformationMessage(
        `🔄 Hook "${hook.name}" is running...`
      );

      const prompt = this.generatePrompt(hook, context);

      const provider = this.providerManager.getCurrentProvider();
      if (!provider) {
        throw new Error("No AI provider configured");
      }

      const response = await provider.sendMessage(prompt);

      await this.applyChanges(context, response.content);

      vscode.window.showInformationMessage(
        `✅ Hook "${hook.name}" executed successfully!`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`❌ Hook "${hook.name}" error: ${error}`);
    } finally {
      hook.isRunning = false;
    }
  }

  private generatePrompt(hook: Hook, context: any): string {
    const fileExtension = context.file
      ? context.file.substring(context.file.lastIndexOf("."))
      : "";

    const template = TemplateEngine.findMatchingTemplate(
      hook.naturalLanguage,
      fileExtension
    );

    if (template) {
      return TemplateEngine.generatePrompt(template, context);
    }

    // Generic fallback
    let prompt = `You are a coding assistant. Perform the following task: ${hook.naturalLanguage}\n\n`;

    if (context.content) {
      prompt += `File: ${context.file}\n`;
      prompt += `Language: ${context.language}\n`;
      prompt += `Current content:\n\`\`\`${context.language}\n${context.content}\n\`\`\`\n\n`;
    } else {
      prompt += `File: ${context.file}\n`;
      prompt += `Event: ${context.type}\n\n`;
    }

    prompt += `Please return only the modified code, without extra explanations. `;
    prompt += `When adding KDoc/JSDoc/Docstrings, make sure to respect the existing coding style.`;

    return prompt;
  }

  private async applyChanges(context: any, aiResponse: string): Promise<void> {
    if (!context.content) {
      console.log("AI Response:", aiResponse);
      return;
    }

    try {
      let newContent = aiResponse;
      const codeBlockMatch = aiResponse.match(/```[\w]*\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        newContent = codeBlockMatch[1];
      }

      const document = await vscode.workspace.openTextDocument(context.file);
      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, range, newContent);

      await vscode.workspace.applyEdit(edit);
      await document.save();
    } catch (error) {
      console.error("Error applying changes:", error);
      throw new Error(`Failed to apply changes: ${error}`);
    }
  }

  public resetCooldown(hookId: string, filePath?: string): void {
    if (filePath) {
      const hookFileKey = `${hookId}:${filePath}`;
      this.lastExecution.delete(hookFileKey);
      this.processingFiles.delete(hookFileKey);
      console.log(`🔄 Reset cooldown for hook ${hookId} on file ${filePath}`);
    } else {
      const keysToDelete = Array.from(this.lastExecution.keys()).filter((key) =>
        key.startsWith(`${hookId}:`)
      );
      keysToDelete.forEach((key) => {
        this.lastExecution.delete(key);
        this.processingFiles.delete(key);
      });
      console.log(`🔄 Reset all cooldowns for hook ${hookId}`);
    }
  }

  public dispose(): void {
    this.fileWatchers.forEach((watchers) => {
      watchers.forEach((watcher) => watcher.dispose());
    });
    this.fileWatchers.clear();
    this.lastExecution.clear();
    this.processingFiles.clear();
    console.log(`🧹 HookExecutor disposed and cleaned up`);
  }
}
