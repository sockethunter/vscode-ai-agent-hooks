import * as vscode from 'vscode';

export interface McpTool {
  name: string;
  description: string;
  schema: any;
  handler: (params: any) => Promise<any>;
}

export interface McpExecutionContext {
  workspaceRoot: string;
  triggeredFile: string;
  hookId: string;
  allowedTools: string[];
}

export class McpClient {
  private static instance: McpClient;
  private registeredTools: Map<string, McpTool> = new Map();
  private executionHistory: Array<{ hookId: string; toolName: string; timestamp: Date; result: any }> = [];

  private constructor() {
    this.initializeDefaultTools();
  }

  public static getInstance(): McpClient {
    if (!McpClient.instance) {
      McpClient.instance = new McpClient();
    }
    return McpClient.instance;
  }

  private initializeDefaultTools(): void {
    // File System Tools
    this.registerTool({
      name: 'mcp_filesystem_list',
      description: 'List directory contents',
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list (use this parameter)' },
          directory: { type: 'string', description: 'Alternative to path parameter' },
          recursive: { type: 'boolean', description: 'Include subdirectories' }
        },
        required: []
      },
      handler: this.handleFilesystemList.bind(this)
    });

    this.registerTool({
      name: 'mcp_filesystem_read',
      description: 'Read file contents',
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' }
        },
        required: ['path']
      },
      handler: this.handleFilesystemRead.bind(this)
    });

    this.registerTool({
      name: 'mcp_filesystem_read_multiple',
      description: 'Read multiple files at once',
      schema: {
        type: 'object',
        properties: {
          paths: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Array of file paths to read' 
          }
        },
        required: ['paths']
      },
      handler: this.handleFilesystemReadMultiple.bind(this)
    });

    this.registerTool({
      name: 'mcp_filesystem_write',
      description: 'Write content to a file',
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to write to' },
          content: { type: 'string', description: 'Content to write' },
          encoding: { type: 'string', description: 'File encoding (default: utf8)' }
        },
        required: ['path', 'content']
      },
      handler: this.handleFilesystemWrite.bind(this)
    });

    // Search Tools
    this.registerTool({
      name: 'mcp_search_find',
      description: 'Find files matching pattern',
      schema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern to search for' },
          directory: { type: 'string', description: 'Directory to search in' }
        },
        required: ['pattern']
      },
      handler: this.handleSearchFind.bind(this)
    });

    this.registerTool({
      name: 'mcp_search_grep',
      description: 'Search for text patterns in files',
      schema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Text pattern to search for' },
          filePattern: { type: 'string', description: 'File pattern to search in' },
          caseSensitive: { type: 'boolean', description: 'Case sensitive search' }
        },
        required: ['pattern']
      },
      handler: this.handleSearchGrep.bind(this)
    });

    // Git Tools
    this.registerTool({
      name: 'mcp_git_status',
      description: 'Get git repository status',
      schema: {
        type: 'object',
        properties: {
          workingDirectory: { type: 'string', description: 'Working directory path' }
        }
      },
      handler: this.handleGitStatus.bind(this)
    });

    this.registerTool({
      name: 'mcp_git_log',
      description: 'Get git commit history',
      schema: {
        type: 'object',
        properties: {
          maxCount: { type: 'number', description: 'Maximum number of commits' },
          filePath: { type: 'string', description: 'Filter by file path' }
        }
      },
      handler: this.handleGitLog.bind(this)
    });
  }

  public registerTool(tool: McpTool): void {
    this.registeredTools.set(tool.name, tool);
    console.log(`🔧 Registered MCP tool: ${tool.name}`);
  }

  public getAvailableTools(): string[] {
    return Array.from(this.registeredTools.keys());
  }

  public async getValidatedToolsForProject(workspaceRoot: string): Promise<string[]> {
    const allTools = this.getAvailableTools();
    const validTools: string[] = [];

    for (const toolName of allTools) {
      if (await this.isToolValidForProject(toolName, workspaceRoot)) {
        validTools.push(toolName);
      }
    }

    return validTools;
  }

  private async isToolValidForProject(toolName: string, workspaceRoot: string): Promise<boolean> {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      switch (toolName) {
        case 'mcp_git_status':
        case 'mcp_git_log':
          // Check if .git directory exists
          const gitDir = path.join(workspaceRoot, '.git');
          try {
            await fs.access(gitDir);
            return true;
          } catch {
            return false;
          }

        case 'mcp_filesystem_list':
        case 'mcp_filesystem_read':
        case 'mcp_filesystem_read_multiple':
        case 'mcp_search_find':
        case 'mcp_search_grep':
          // These tools work in any directory
          return true;

        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  public async executeTool(
    toolName: string, 
    params: any, 
    context: McpExecutionContext
  ): Promise<any> {
    const tool = this.registeredTools.get(toolName);
    if (!tool) {
      throw new Error(`MCP tool not found: ${toolName}`);
    }

    // Check if tool is allowed for this hook
    if (!context.allowedTools.includes(toolName)) {
      throw new Error(`MCP tool not allowed for this hook: ${toolName}`);
    }

    console.log(`🚀 Executing MCP tool: ${toolName} with params:`, params);

    try {
      const result = await tool.handler({ ...params, context });
      
      // Log execution history
      this.executionHistory.push({
        hookId: context.hookId,
        toolName,
        timestamp: new Date(),
        result: typeof result === 'object' ? JSON.stringify(result) : result
      });

      console.log(`✅ MCP tool executed successfully: ${toolName}`);
      return result;
    } catch (error) {
      console.error(`❌ MCP tool execution failed: ${toolName}`, error);
      throw error;
    }
  }

  public getExecutionHistory(hookId?: string): Array<any> {
    if (hookId) {
      return this.executionHistory.filter(entry => entry.hookId === hookId);
    }
    return this.executionHistory;
  }

  // Tool Handlers
  private async handleFilesystemList(params: any): Promise<any> {
    // Support both 'path' and 'directory' parameters for backward compatibility
    const { path, directory, recursive = false, context } = params;
    const targetPath = path || directory;
    const fs = require('fs').promises;
    const pathModule = require('path');

    try {
      if (!targetPath) {
        throw new Error('Missing required parameter: path or directory');
      }
      
      let fullPath = targetPath;
      if (!pathModule.isAbsolute(targetPath)) {
        fullPath = pathModule.join(context.workspaceRoot, targetPath);
      }

      if (recursive) {
        return await this.recursiveDirectoryList(fullPath);
      } else {
        const items = await fs.readdir(fullPath, { withFileTypes: true });
        return items.map((item: any) => ({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: pathModule.join(fullPath, item.name)
        }));
      }
    } catch (error) {
      throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async recursiveDirectoryList(dirPath: string): Promise<any[]> {
    const fs = require('fs').promises;
    const pathModule = require('path');
    const results: any[] = [];

    async function scan(currentPath: string): Promise<void> {
      const items = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = pathModule.join(currentPath, item.name);
        const result = {
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: itemPath
        };
        
        results.push(result);
        
        if (item.isDirectory() && !item.name.startsWith('.')) {
          await scan(itemPath);
        }
      }
    }

    await scan(dirPath);
    return results;
  }

  private async handleFilesystemRead(params: any): Promise<any> {
    const { path, context } = params;
    const fs = require('fs').promises;
    const pathModule = require('path');

    try {
      let fullPath = path;
      if (!pathModule.isAbsolute(path)) {
        fullPath = pathModule.join(context.workspaceRoot, path);
      }

      const content = await fs.readFile(fullPath, 'utf8');
      return {
        path: fullPath,
        content,
        size: content.length,
        lines: content.split('\n').length
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleFilesystemReadMultiple(params: any): Promise<any> {
    const { paths, context } = params;
    const results = [];

    for (const path of paths) {
      try {
        const result = await this.handleFilesystemRead({ path, context });
        results.push(result);
      } catch (error) {
        results.push({
          path,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  private async handleFilesystemWrite(params: any): Promise<any> {
    const { path, content, encoding = 'utf8', context } = params;
    const fs = require('fs').promises;
    const pathModule = require('path');

    try {
      let fullPath = path;
      if (!pathModule.isAbsolute(path)) {
        fullPath = pathModule.join(context.workspaceRoot, path);
      }

      // Ensure directory exists
      const dir = pathModule.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      // Write the file
      await fs.writeFile(fullPath, content, encoding);
      
      return {
        path: fullPath,
        bytesWritten: content.length,
        encoding,
        success: true
      };
    } catch (error) {
      throw new Error(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleSearchFind(params: any): Promise<any> {
    const { pattern, directory = '.', context } = params;
    const vscode = require('vscode');
    const pathModule = require('path');

    try {
      // Use VSCode's workspace.findFiles instead of glob
      let searchPattern = pattern;
      
      // Handle directory parameter
      if (directory !== '.') {
        if (pathModule.isAbsolute(directory)) {
          // Convert absolute path to relative to workspace
          const relativePath = pathModule.relative(context.workspaceRoot, directory);
          searchPattern = pathModule.join(relativePath, pattern).replace(/\\/g, '/');
        } else {
          searchPattern = pathModule.join(directory, pattern).replace(/\\/g, '/');
        }
      }

      console.log(`🔍 Searching for pattern: ${searchPattern} in workspace: ${context.workspaceRoot}`);

      // Use VSCode API to find files
      const fileUris = await vscode.workspace.findFiles(searchPattern, '**/node_modules/**');
      const matches = fileUris.map((uri: any) => uri.fsPath);

      console.log(`📁 Found ${matches.length} files matching pattern: ${searchPattern}`);
      
      return {
        pattern: searchPattern,
        matches,
        count: matches.length
      };
    } catch (error) {
      throw new Error(`Failed to find files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleSearchGrep(params: any): Promise<any> {
    const { pattern, filePattern = '**/*', caseSensitive = false, context } = params;
    const vscode = require('vscode');
    const fs = require('fs').promises;

    try {
      // Use VSCode API to find files
      const fileUris = await vscode.workspace.findFiles(filePattern, '**/node_modules/**');
      const files = fileUris.map((uri: any) => uri.fsPath);

      const results: Array<{file: string; matches: Array<{lineNumber: number; line: string; column: number}>}> = [];
      const regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const lines = content.split('\n');
          const matches: Array<{lineNumber: number; line: string; column: number}> = [];

          lines.forEach((line: string, index: number) => {
            if (regex.test(line)) {
              matches.push({
                lineNumber: index + 1,
                line: line.trim(),
                column: line.indexOf(pattern)
              });
            }
          });

          if (matches.length > 0) {
            results.push({
              file,
              matches
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      return {
        pattern,
        results,
        totalMatches: results.reduce((sum, file) => sum + file.matches.length, 0)
      };
    } catch (error) {
      throw new Error(`Failed to search files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGitStatus(params: any): Promise<any> {
    const { workingDirectory = '.', context } = params;
    const { exec } = require('child_process');
    const pathModule = require('path');

    try {
      let workDir = workingDirectory;
      if (!pathModule.isAbsolute(workingDirectory)) {
        workDir = pathModule.join(context.workspaceRoot, workingDirectory);
      }

      const result = await new Promise((resolve, reject) => {
        exec('git status --porcelain', { cwd: workDir }, (error: any, stdout: string, stderr: string) => {
          if (error) {
            reject(new Error(`Git status failed: ${stderr}`));
          } else {
            resolve(stdout);
          }
        });
      });

      const lines = (result as string).trim().split('\n').filter(line => line);
      const files = lines.map(line => {
        const status = line.substring(0, 2);
        const filename = line.substring(3);
        return { status, filename };
      });

      return {
        workingDirectory: workDir,
        files,
        isDirty: files.length > 0
      };
    } catch (error) {
      throw new Error(`Failed to get git status: ${error}`);
    }
  }

  private async handleGitLog(params: any): Promise<any> {
    const { maxCount = 10, filePath, context } = params;
    const { exec } = require('child_process');

    try {
      let command = `git log --oneline -n ${maxCount}`;
      if (filePath) {
        command += ` -- ${filePath}`;
      }

      const result = await new Promise((resolve, reject) => {
        exec(command, { cwd: context.workspaceRoot }, (error: any, stdout: string, stderr: string) => {
          if (error) {
            reject(new Error(`Git log failed: ${stderr}`));
          } else {
            resolve(stdout);
          }
        });
      });

      const lines = (result as string).trim().split('\n').filter(line => line);
      const commits = lines.map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash,
          message: messageParts.join(' ')
        };
      });

      return {
        commits,
        count: commits.length,
        filePath
      };
    } catch (error) {
      throw new Error(`Failed to get git log: ${error}`);
    }
  }
}