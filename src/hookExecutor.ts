import * as vscode from "vscode";
import { Hook, HookExecutionMode } from "./hookManager";
import { ProviderManager } from "./providers/providerManager";
import { TemplateEngine } from "./templates/hookTemplates";
import { MultiStepExecutor } from "./mcp/multiStepExecutor";

export class HookExecutor {
  private static instance: HookExecutor;
  private providerManager: ProviderManager;
  private multiStepExecutor: MultiStepExecutor;
  private fileWatchers: Map<string, vscode.FileSystemWatcher[]> = new Map();
  private lastExecution: Map<string, number> = new Map(); // Track last execution time per file
  private readonly COOLDOWN_MS = 5000; // 5 seconds cooldown
  private processingFiles: Set<string> = new Set(); // Track files currently being processed
  private hookGeneratedFiles: Set<string> = new Set(); // Track files modified by hooks to prevent cross-triggering
  private runningHooks: Map<string, AbortController> = new Map(); // Track running hooks for cancellation
  private executionQueue: Map<string, { hook: Hook; context: any }[]> = new Map(); // Queue for sequential execution

  private constructor() {
    this.providerManager = ProviderManager.getInstance();
    this.multiStepExecutor = MultiStepExecutor.getInstance();
  }

  public static getInstance(): HookExecutor {
    if (!HookExecutor.instance) {
      HookExecutor.instance = new HookExecutor();
    }
    return HookExecutor.instance;
  }

  public registerHook(hook: Hook): void {
    console.log(
      `🔧 Registering hook: ${hook.name} (${hook.id}) - Active: ${hook.isActive}, Trigger: ${hook.trigger}, Pattern: ${hook.filePattern}`
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

  public stopRunningHook(hookId: string): void {
    const abortController = this.runningHooks.get(hookId);
    if (abortController) {
      console.log(`⏹️ Stopping running hook: ${hookId}`);
      abortController.abort();
    } else {
      console.log(`❌ No running hook found with ID: ${hookId}`);
    }
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
    
    console.log(
      `🎯 handleFileEvent called for hook: ${hook.name}, file: ${filePath}, event: ${eventType}`
    );

    // Check if this file was recently modified by a hook (prevent cross-triggering)
    if (this.hookGeneratedFiles.has(filePath)) {
      console.log(
        `🚫 File ${filePath} was recently modified by a hook, skipping to prevent cross-triggering`
      );
      this.hookGeneratedFiles.delete(filePath); // Remove from set after checking
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

    const context = {
      type: eventType,
      file: filePath,
      content: document.getText(),
      language: document.languageId,
    };

    // Add to sequential execution queue for this file
    await this.enqueueHookExecution(filePath, hook, context);
  }

  private async handleFileSystemEvent(
    hook: Hook,
    uri: vscode.Uri,
    eventType: string
  ): Promise<void> {
    if (!this.matchesFilePattern(uri.fsPath, hook)) {
      return;
    }

    const context = {
      type: eventType,
      file: uri.fsPath,
    };

    // Add to sequential execution queue for this file
    await this.enqueueHookExecution(uri.fsPath, hook, context);
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
    const patterns = hook.filePattern.split(",").map((p) => p.trim());

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
    const normalizedPath = filePath.replace(/\\/g, "/");
    const normalizedPattern = pattern.replace(/\\/g, "/");

    console.log(
      `🔍 Matching path: ${normalizedPath} against pattern: ${normalizedPattern}`
    );

    // Handle simple patterns first
    if (normalizedPattern === "**/*") {
      return true; // Match everything
    }

    // Convert glob to regex
    let regexPattern = normalizedPattern
      .replace(/\./g, "\\.") // Escape dots first!
      .replace(/\*\*/g, ".*") // ** matches any directory depth
      .replace(/\*/g, "[^/]*") // * matches any file/directory name (but not /)
      .replace(/\?/g, "[^/]"); // ? matches single character (but not /)

    // Ensure the pattern matches the end of the path
    if (!regexPattern.startsWith(".*")) {
      regexPattern = ".*" + regexPattern;
    }
    if (!regexPattern.endsWith("$")) {
      regexPattern = regexPattern + "$";
    }

    const regex = new RegExp(regexPattern, "i"); // Case insensitive
    const matches = regex.test(normalizedPath);

    console.log(`🔍 Regex: ${regexPattern}, Result: ${matches}`);
    return matches;
  }

  private async enqueueHookExecution(filePath: string, hook: Hook, context: any): Promise<void> {
    const queueKey = filePath;
    
    // Get or create queue for this file
    if (!this.executionQueue.has(queueKey)) {
      this.executionQueue.set(queueKey, []);
    }
    
    const queue = this.executionQueue.get(queueKey)!;
    
    // Add hook to queue
    queue.push({ hook, context });
    console.log(`📋 Added hook ${hook.name} to queue for file ${filePath}. Queue length: ${queue.length}`);
    
    // Sort queue by priority (higher priority first)
    queue.sort((a, b) => b.hook.priority - a.hook.priority);
    
    // Process queue if not already processing
    if (queue.length === 1) {
      await this.processExecutionQueue(queueKey);
    }
  }

  private async processExecutionQueue(queueKey: string): Promise<void> {
    const queue = this.executionQueue.get(queueKey);
    if (!queue || queue.length === 0) {
      return;
    }
    
    console.log(`🔄 Processing execution queue for file: ${queueKey}`);
    
    while (queue.length > 0) {
      const { hook, context } = queue.shift()!;
      
      try {
        console.log(`▶️ Processing hook ${hook.name} (priority: ${hook.priority}) from queue`);
        await this.scheduleHookExecution(queueKey, hook, context);
        
        // Wait a bit between executions to prevent overwhelming
        if (queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`❌ Error processing hook ${hook.name} from queue:`, error);
        // Continue with next hook in queue
      }
    }
    
    // Clean up empty queue
    if (queue.length === 0) {
      this.executionQueue.delete(queueKey);
      console.log(`🧹 Cleaned up empty queue for file: ${queueKey}`);
    }
  }

  private async scheduleHookExecution(filePath: string, hook: Hook, context: any): Promise<void> {
    console.log(`📋 Scheduling hook execution: ${hook.name} for file: ${filePath}`);
    
    const hookFileKey = `${hook.id}:${filePath}`;

    // Check execution mode
    switch (hook.executionMode) {
      case 'multiple':
        // Allow multiple executions, no restrictions
        console.log(`🔄 Multiple execution mode - starting hook immediately`);
        await this.executeHookWithChecks(hook, context);
        break;

      case 'single':
        // Only one execution at a time
        if (this.runningHooks.has(hook.id)) {
          console.log(`🚫 Hook ${hook.name} is already running, ignoring new execution (single mode)`);
          return;
        }
        
        // Check cooldown
        if (!this.canExecuteAfterCooldown(hookFileKey)) {
          return;
        }
        
        console.log(`▶️ Single execution mode - starting hook`);
        await this.executeHookWithChecks(hook, context);
        break;

      case 'restart':
        // Stop existing execution and start new one
        if (this.runningHooks.has(hook.id)) {
          console.log(`🔄 Hook ${hook.name} is running - stopping and restarting (restart mode)`);
          this.stopRunningHook(hook.id);
          // Wait a bit for the previous execution to stop
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`🔁 Restart execution mode - starting hook`);
        await this.executeHookWithChecks(hook, context);
        break;
    }
  }

  private canExecuteAfterCooldown(hookFileKey: string): boolean {
    const lastExecTime = this.lastExecution.get(hookFileKey) || 0;
    const now = Date.now();
    const timeSinceLastExec = now - lastExecTime;

    if (timeSinceLastExec < this.COOLDOWN_MS) {
      const remainingCooldown = this.COOLDOWN_MS - timeSinceLastExec;
      console.log(
        `⏳ Hook is on cooldown. ${remainingCooldown}ms remaining`
      );
      return false;
    }
    
    return true;
  }

  private async executeHookWithChecks(hook: Hook, context: any): Promise<void> {
    const hookFileKey = `${hook.id}:${context.file}`;

    // Prevent recursion: check if file is already being processed by this hook
    if (this.processingFiles.has(hookFileKey)) {
      console.log(
        `🔄 File ${context.file} is already being processed by hook ${hook.name}, skipping`
      );
      return;
    }

    // Mark file as processing
    this.processingFiles.add(hookFileKey);

    try {
      // Update last execution time
      this.lastExecution.set(hookFileKey, Date.now());

      await this.executeHook(hook, context);
    } finally {
      this.processingFiles.delete(hookFileKey);
    }
  }

  public async executeHook(hook: Hook, context: any): Promise<void> {
    // Create abort controller for this execution
    const abortController = new AbortController();
    this.runningHooks.set(hook.id, abortController);

    // Notify HookManager that hook is starting
    this.notifyHookManager(hook.id, true, new Date());

    try {
      vscode.window.showInformationMessage(
        `🔄 Hook "${hook.name}" is running...`
      );

      // Check if hook was stopped before we start
      if (abortController.signal.aborted) {
        throw new Error("Hook execution was cancelled");
      }

      // Check if this hook is configured for MCP multi-step execution
      if (hook.mcpEnabled && hook.multiStepEnabled) {
        console.log(`🚀 Using MCP multi-step execution for hook: ${hook.name}`);
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
          throw new Error("No workspace root found for MCP execution");
        }

        await this.multiStepExecutor.executeHookWithMcp(
          hook,
          context.file,
          workspaceRoot
        );

        // Only show success if not cancelled
        if (!abortController.signal.aborted) {
          vscode.window.showInformationMessage(
            `✅ Hook "${hook.name}" executed successfully with MCP!`
          );
        }
        return;
      }

      // Standard execution path
      const prompt = this.generatePrompt(hook, context);

      const provider = this.providerManager.getCurrentProvider();
      if (!provider) {
        throw new Error("No AI provider configured");
      }

      // Check again before making AI request
      if (abortController.signal.aborted) {
        throw new Error("Hook execution was cancelled");
      }

      const response = await provider.sendMessage(prompt);

      // Check again before applying changes
      if (abortController.signal.aborted) {
        throw new Error("Hook execution was cancelled");
      }

      await this.applyChanges(context, response.content);

      // Only show success if not cancelled
      if (!abortController.signal.aborted) {
        vscode.window.showInformationMessage(
          `✅ Hook "${hook.name}" executed successfully!`
        );
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        vscode.window.showWarningMessage(`⏹️ Hook "${hook.name}" was stopped`);
      } else {
        vscode.window.showErrorMessage(`❌ Hook "${hook.name}" error: ${error}`);
      }
    } finally {
      // Clean up
      this.runningHooks.delete(hook.id);
      // Notify HookManager that hook is finished
      this.notifyHookManager(hook.id, false);
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

      if (context.type === "create" || context.type === "delete") {
        prompt += `This is a file system event. The file was ${context.type}d.\n`;
        prompt += `Workspace root: ${this.getWorkspaceRoot()}\n`;
        prompt += `If you need to update a specific file (like README.md), start your response with:\n`;
        prompt += `TARGET_FILE: README.md\n\n`;
        prompt += `This will update the README.md in the workspace root directory.\n`;
        prompt += `Then provide the complete new content for that file.\n`;
        prompt += `If updating README.md, include the existing content and add your changes.\n\n`;
      }
    }

    prompt += `Please return only the modified code, without extra explanations. `;
    prompt += `When adding KDoc/JSDoc/Docstrings, make sure to respect the existing coding style.`;

    return prompt;
  }

  private async applyChanges(context: any, aiResponse: string): Promise<void> {
    if (
      !context.content &&
      context.type !== "create" &&
      context.type !== "delete"
    ) {
      console.log("AI Response:", aiResponse);
      return;
    }

    try {
      let newContent = aiResponse;

      // Extract code from markdown blocks if present
      const codeBlockMatch = aiResponse.match(/```[\w]*\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        newContent = codeBlockMatch[1];
      }

      // For file system events, try to extract target file from AI response
      if (
        !context.content &&
        (context.type === "create" || context.type === "delete")
      ) {
        const targetFileMatch = aiResponse.match(/TARGET_FILE:\s*([^\n\r]+)/i);
        if (targetFileMatch) {
          let targetFile = targetFileMatch[1].trim();
          console.log(`📝 AI specified target file: ${targetFile}`);

          // If it's a relative path, resolve it to workspace root
          if (!targetFile.startsWith("/")) {
            const workspaceRoot = this.getWorkspaceRoot();
            if (workspaceRoot) {
              targetFile = vscode.Uri.joinPath(
                vscode.Uri.file(workspaceRoot),
                targetFile
              ).fsPath;
            }
          }

          console.log(`📁 Resolved target file path: ${targetFile}`);

          // Extract content after TARGET_FILE line
          const contentAfterTarget = aiResponse
            .replace(/TARGET_FILE:[^\n\r]*[\n\r]*/, "")
            .trim();
          console.log(
            `📝 Content to write: ${contentAfterTarget.substring(0, 100)}...`
          );

          try {
            // Create or update the target file
            const fileUri = vscode.Uri.file(targetFile);
            const edit = new vscode.WorkspaceEdit();

            // Check if file exists
            try {
              const existingDoc = await vscode.workspace.openTextDocument(
                fileUri
              );
              // File exists, replace content
              const range = new vscode.Range(
                existingDoc.positionAt(0),
                existingDoc.positionAt(existingDoc.getText().length)
              );
              edit.replace(fileUri, range, contentAfterTarget);
              console.log(
                `📝 Replacing content in existing file: ${targetFile}`
              );
            } catch {
              // File doesn't exist, create it
              edit.createFile(fileUri, { ignoreIfExists: true });
              edit.insert(
                fileUri,
                new vscode.Position(0, 0),
                contentAfterTarget
              );
              console.log(`📄 Creating new file: ${targetFile}`);
            }

            await vscode.workspace.applyEdit(edit);

            // Save the file
            try {
              const document = await vscode.workspace.openTextDocument(fileUri);
              await document.save();
              
              // Mark this file as hook-generated to prevent cross-triggering
              this.hookGeneratedFiles.add(targetFile);
              console.log(`🔒 Marked ${targetFile} as hook-generated`);
              
              vscode.window.showInformationMessage(`📝 Updated ${targetFile}`);
            } catch (saveError) {
              console.error(`Error saving file ${targetFile}:`, saveError);
              vscode.window.showErrorMessage(
                `Could not save ${targetFile}: ${saveError}`
              );
            }

            return;
          } catch (error) {
            console.error(`Error updating target file ${targetFile}:`, error);
            vscode.window.showErrorMessage(
              `Error updating ${targetFile}: ${error}`
            );
          }
        }

        // If all else fails, just show the response
        vscode.window.showInformationMessage(`🤖 AI Response: ${aiResponse}`);
        return;
      }

      // Normal file content replacement for text document events
      const document = await vscode.workspace.openTextDocument(context.file);
      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
      );
      edit.replace(document.uri, range, newContent);

      await vscode.workspace.applyEdit(edit);
      await document.save();
      
      // Mark this file as hook-generated to prevent cross-triggering
      this.hookGeneratedFiles.add(context.file);
      console.log(`🔒 Marked ${context.file} as hook-generated`);
    } catch (error) {
      console.error("Error applying changes:", error);
      throw new Error(`Failed to apply changes: ${error}`);
    }
  }

  private async notifyHookManager(hookId: string, isRunning: boolean, lastExecuted?: Date): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { HookManager } = await import("./hookManager");
      const hookManager = HookManager.getInstance();
      hookManager.updateHookStatus(hookId, isRunning, lastExecuted);
    } catch (error) {
      console.error("Error notifying HookManager:", error);
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

  private getWorkspaceRoot(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return null;
  }

  public dispose(): void {
    // Stop all running hooks
    this.runningHooks.forEach((controller, hookId) => {
      console.log(`⏹️ Aborting running hook during dispose: ${hookId}`);
      controller.abort();
    });
    this.runningHooks.clear();

    this.fileWatchers.forEach((watchers) => {
      watchers.forEach((watcher) => watcher.dispose());
    });
    this.fileWatchers.clear();
    this.lastExecution.clear();
    this.processingFiles.clear();
    this.hookGeneratedFiles.clear();
    this.executionQueue.clear();
    console.log(`🧹 HookExecutor disposed and cleaned up`);
  }
}
