import * as vscode from 'vscode';
import * as path from 'path';
import { HookManager } from '../hookManager';
import { ProviderManager } from '../providers/providerManager';
import { McpClient } from '../mcp/mcpClient';

export class VibeProvider implements vscode.Disposable {
    public static readonly viewType = 'vibeMode';

    private _panel?: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];
    private context: vscode.ExtensionContext;
    private hookManager?: HookManager;
    private providerManager?: ProviderManager;
    private mcpClient?: McpClient;
    private chatHistory: ChatMessage[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public initialize(
        hookManager: HookManager, 
        providerManager: ProviderManager,
        mcpClient: McpClient
    ): void {
        this.hookManager = hookManager;
        this.providerManager = providerManager;
        this.mcpClient = mcpClient;
        
        // Subscribe to hook status changes
        this.disposables.push(
            hookManager.onHookStatusChanged(() => {
                console.log('🔄 Hook status changed, updating Vibe Mode');
                this.sendHookStatus();
            })
        );
    }

    public createPanel(): void {
        console.log('🚀 Creating Vibe Mode panel');
        
        // Create webview panel for vibe mode
        this._panel = vscode.window.createWebviewPanel(
            VibeProvider.viewType,
            'HookFlow - Vibe Mode',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [this.context.extensionUri],
            }
        );

        this.setupWebviewPanel(this._panel);
    }

    public setupWebviewPanel(panel: vscode.WebviewPanel): void {
        console.log('🎨 Setting up Vibe Mode panel');
        this._panel = panel;
        
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };

        console.log('🎨 Setting Vibe WebView HTML...');
        panel.webview.html = this.getHtmlForWebview();
        console.log('✅ Vibe WebView HTML set successfully');

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            (message) => this.handleMessage(message),
            undefined,
            this.disposables
        );

        // Send initial state after setup
        setTimeout(async () => {
            console.log('📤 Sending initial data to Vibe WebView...');
            this.sendChatHistory();
            this.sendHookStatus();
            
            // Get MCP tools data
            const mcpToolsData = await this.getMcpToolsData();
            console.log('🔧 Sending MCP tools data to webview:', mcpToolsData);
            
            this.sendMessage('initialized', {
                hooks: this.hookManager?.getHooks() || [],
                mcpTools: mcpToolsData
            });
            
            console.log('✅ Initial data sent to Vibe WebView');
        }, 500);

        // Clean up when panel is disposed
        panel.onDidDispose(() => {
            this._panel = undefined;
        }, null, this.disposables);
    }

    private async handleMessage(message: any): Promise<void> {
        console.log('🔄 Vibe Provider received message:', message);
        
        switch (message.command) {
            case 'initialize':
                await this.handleInitialize();
                break;
            case 'sendMessage':
                await this.handleChatMessage(message.message);
                break;
            case 'clearChat':
                this.clearChat();
                break;
            case 'executeHook':
                await this.executeHookById(message.hookId);
                break;
            case 'toggleHook':
                await this.toggleHookById(message.hookId);
                break;
            case 'refreshHooks':
                this.sendHookStatus();
                break;
            case 'toggleMcpTool':
                await this.handleToggleMcpTool(message.toolName, message.enabled);
                break;
            case 'openHookManager':
                vscode.commands.executeCommand('ai-agent-hooks.manageHooks');
                break;
            default:
                console.log('Unknown Vibe command:', message.command);
        }
    }

    private async handleInitialize(): Promise<void> {
        console.log('✅ Vibe Mode initialized via message from WebView');
        
        try {
            // Get current data
            const hooks = this.hookManager?.getHooks() || [];
            const mcpTools = await this.getMcpToolsData();
            
            // Send initialization response with current data
            this.sendMessage('initialized', {
                hooks,
                mcpTools
            });
            
            // Also send connection status
            this.sendMessage('connectionStatus', {
                status: 'online',
                message: 'Connected to HookFlow'
            });
            
            console.log(`✅ Sent initialization data: ${hooks.length} hooks, ${mcpTools.length} MCP tools`);
        } catch (error) {
            console.error('❌ Error during initialization:', error);
            this.sendMessage('connectionStatus', {
                status: 'error',
                message: `Initialization failed: ${error}`
            });
        }
    }

    private async getMcpToolsData(): Promise<any[]> {
        if (!this.mcpClient || !this.hookManager) {return [];}
        
        try {
            const allTools = this.mcpClient.getAvailableTools();
            const enabledTools = await this.hookManager.getAvailableMcpTools();
            const mcpToolsData = await this.hookManager.getProjectSpecificMcpTools();
            
            return allTools.map(toolName => ({
                name: toolName,
                description: mcpToolsData?.descriptions[toolName] || `MCP tool: ${toolName}`,
                enabled: enabledTools.includes(toolName)
            }));
        } catch (error) {
            console.error('Error getting MCP tools:', error);
            return [];
        }
    }

    private async handleChatMessage(userMessage: string): Promise<void> {
        // Add user message to history
        this.addMessage('user', userMessage);

        try {
            if (!this.providerManager || !this.mcpClient) {
                this.addMessage('assistant', 'AI provider or MCP client not available.');
                return;
            }

            // Check if this is a hook-related command
            if (this.isHookCommand(userMessage)) {
                await this.handleHookCommand(userMessage);
                return;
            }

            // Get MCP tool information from centralized source
            const hookStatus = this.getHookStatusSummary();
            
            // Build conversation messages array
            const conversationMessages: Array<{role: 'user' | 'assistant' | 'system', content: string}> = [];
            
            // Add system prompt only if this is the first message
            const isFirstMessage = this.chatHistory.length <= 1;
            if (isFirstMessage) {
                let systemPrompt = `You are HookFlow Assistant, an AI agent that helps manage and interact with VSCode hooks.

Current Hook Status: ${hookStatus}

Context: You can help with:
- Creating and managing hooks  
- Analyzing hook configurations
- Debugging hook execution
- Explaining hook behavior and patterns
- General guidance on VSCode automation`;

                // Get MCP tools for system prompt
                const mcpToolsForPrompt = await this.hookManager?.getProjectSpecificMcpTools();
                if (mcpToolsForPrompt && mcpToolsForPrompt.available.length > 0) {
                    const toolDescriptions = mcpToolsForPrompt.available.map(tool => 
                        `${tool}: ${mcpToolsForPrompt.descriptions[tool] || 'MCP tool'}`
                    ).join('\n');
                    
                    systemPrompt += `
- File operations using MCP tools
- Code analysis and project exploration

Available MCP Tools:
${toolDescriptions}

IMPORTANT: When users ask about the project, files, or need analysis, you should proactively use the available MCP tools to gather information BEFORE responding. For example:
- If asked "What does this project do?" -> Use mcp_filesystem_list and mcp_filesystem_read to examine files
- If asked about specific files -> Use mcp_filesystem_read to read them
- If asked to search for something -> Use mcp_search_find
- If asked about git status -> Use mcp_git_status

Always gather the necessary information using tools, then provide a comprehensive answer based on what you found.

CRITICAL: If any MCP tools failed during execution, you MUST mention this in your response and explain what went wrong. Don't pretend everything worked when tools failed.`;
                }
                
                conversationMessages.push({role: 'system', content: systemPrompt});
            }
            
            // Add recent chat history (last 8 messages to keep context manageable)
            const recentHistory = this.chatHistory.slice(-8);
            recentHistory.forEach(msg => {
                conversationMessages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            });

            console.log('🤖 Letting AI think about what tools are needed...');
            
            if (!this.hookManager) {
                console.log('🚫 HookManager not available, generating basic response');
                const basicResponse = await this.providerManager.generateConversationResponse(conversationMessages);
                this.addMessage('assistant', basicResponse);
                return;
            }

            // Step 1: Let AI think about what tools it needs
            const mcpToolsData = await this.hookManager.getProjectSpecificMcpTools();
            const availableTools = mcpToolsData?.available || [];
            
            // Build thinking prompt with chat context
            const thinkingPrompt = [];
            
            // Add recent conversation context
            const recentContext = this.chatHistory.slice(-6) // Last 6 messages for context
                .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
                .join('\n');
                
            thinkingPrompt.push({
                role: 'system' as const,
                content: `You are an AI assistant that can use MCP tools to gather information before responding.

Available MCP Tools:
${availableTools.map(tool => `- ${tool}: ${mcpToolsData?.descriptions[tool] || 'MCP tool'}`).join('\n')}

RECENT CONVERSATION CONTEXT:
${recentContext}

CURRENT USER MESSAGE: "${userMessage}"

THINK: Based on the conversation context and current user message, what information do I need to properly respond? Which tools should I execute?

Consider:
1. Do I need to list files? (use mcp_filesystem_list)
2. Do I need to read specific files? (use mcp_filesystem_read) 
3. Do I need to search for content? (use mcp_search_find)
4. Do I need git information? (use mcp_git_status)
5. Do I need to write to files? (use mcp_filesystem_write)

IMPORTANT: Consider the conversation context! If I previously asked a question and the user is responding (like "yes", "ja", "no"), I should act accordingly and use appropriate tools.

Respond ONLY with a JSON object like:
{
  "needsTools": true/false,
  "tools": [
    {"tool": "mcp_filesystem_list", "params": {"path": "."}},
    {"tool": "mcp_filesystem_read", "params": {"path": "package.json"}},
    {"tool": "mcp_filesystem_write", "params": {"path": "main.py", "content": "new code here"}}
  ],
  "reasoning": "I need to..."
}`
            });

            // Iterative thinking loop - keep thinking and executing tools until AI is satisfied
            const allToolResults: string[] = [];
            let thinkingIteration = 0;
            const maxIterations = 5; // Prevent infinite loops
            
            while (thinkingIteration < maxIterations) {
                thinkingIteration++;
                console.log(`🧠 AI thinking iteration ${thinkingIteration}...`);
                
                // Update thinking prompt with accumulated results
                const contextWithResults = recentContext + (allToolResults.length > 0 ? `\n\nTOOL RESULTS SO FAR:\n${allToolResults.join('\n\n')}` : '');
                
                thinkingPrompt[0].content = `You are an AI assistant that can use MCP tools to gather information before responding.

Available MCP Tools:
${availableTools.map(tool => `- ${tool}: ${mcpToolsData?.descriptions[tool] || 'MCP tool'}`).join('\n')}

RECENT CONVERSATION CONTEXT:
${contextWithResults}

CURRENT USER MESSAGE: "${userMessage}"

THINK: Based on the conversation context, current user message, and any tool results so far, what information do I STILL need to properly respond? 

Consider:
1. Do I need to list files? (use mcp_filesystem_list)
2. Do I need to read specific files? (use mcp_filesystem_read) 
3. Do I need to search for content? (use mcp_search_find)
4. Do I need git information? (use mcp_git_status)
5. Do I need to write to files? (use mcp_filesystem_write)

IMPORTANT: 
- If I have tool results, analyze them and determine if I need MORE information
- If I see file names in tool results, I might need to READ those files to understand what they do
- Keep thinking until I have enough information to give a complete answer

Respond ONLY with a JSON object like:
{
  "needsMoreTools": true/false,
  "tools": [
    {"tool": "mcp_filesystem_read", "params": {"path": "main.py"}}
  ],
  "reasoning": "I need to...",
  "readyToRespond": true/false
}`;

                const thinkingResponse = await this.providerManager.generateConversationResponse(thinkingPrompt);
                console.log(`🧠 AI thinking iteration ${thinkingIteration} response:`, thinkingResponse);
                
                // Parse AI's tool decision
                let toolPlan: any = null;
                try {
                    const jsonMatch = thinkingResponse.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        toolPlan = JSON.parse(jsonMatch[0]);
                    }
                } catch (e) {
                    console.log('🤔 Could not parse AI tool planning, stopping iteration');
                    break;
                }

                // Execute tools based on AI's decision
                if (toolPlan?.needsMoreTools && toolPlan.tools) {
                    console.log(`🔧 AI iteration ${thinkingIteration}: executing ${toolPlan.tools.length} tools - ${toolPlan.reasoning}`);
                    
                    for (const toolCall of toolPlan.tools) {
                        try {
                            const result = await this.hookManager.executeMcpToolForChat(toolCall.tool, toolCall.params || {});
                            const formattedResult = this.hookManager.formatMcpToolResult(toolCall.tool, result);
                            allToolResults.push(formattedResult);
                            console.log(`✅ Executed ${toolCall.tool}`);
                        } catch (toolError) {
                            console.error(`❌ Error executing ${toolCall.tool}:`, toolError);
                            const errorMessage = `❌ Error executing ${toolCall.tool}: ${toolError instanceof Error ? toolError.message : 'Unknown error'}`;
                            allToolResults.push(errorMessage);
                            
                            // Show error in chat immediately so user sees it
                            this.addMessage('assistant', `🚨 Tool Error: ${errorMessage}`);
                        }
                    }
                } else if (toolPlan?.readyToRespond === true) {
                    console.log(`🎯 AI is ready to respond after ${thinkingIteration} iterations`);
                    break;
                } else {
                    console.log(`🚫 AI decided no more tools needed after ${thinkingIteration} iterations`);
                    break;
                }
            }
            
            if (thinkingIteration >= maxIterations) {
                console.log('⚠️ Max thinking iterations reached, proceeding with response');
            }

            // Add tool results to conversation if any were executed
            if (allToolResults.length > 0) {
                console.log(`📋 Adding ${allToolResults.length} tool results to conversation context`);
                
                // Check if there were any errors in the tool results
                const hasErrors = allToolResults.some(result => result.includes('❌ Error executing'));
                const toolResultsHeader = hasErrors ? 
                    `[MCP Tool Results - Some tools failed:]\n` : 
                    `[I gathered this information using MCP tools:]\n`;
                    
                conversationMessages.push({
                    role: 'assistant',
                    content: toolResultsHeader + allToolResults.join('\n\n')
                });
            }
            
            // Generate final response with tool context
            console.log('🤖 Generating final AI response with gathered information...');
            const finalResponse = await this.providerManager.generateConversationResponse(conversationMessages);
            this.addMessage('assistant', finalResponse);

            console.log('✅ AI response generated successfully');

        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            this.addMessage('assistant', errorMessage);
            this.sendMessage('error', { error: errorMessage });
        }
    }

    private isHookCommand(message: string): boolean {
        const hookCommands = [
            'create hook', 'new hook', 'add hook',
            'list hooks', 'show hooks', 'status',
            'run hook', 'execute hook', 'trigger hook',
            'stop hook', 'pause hook', 'disable hook',
            'enable hook', 'activate hook'
        ];
        
        const lowerMessage = message.toLowerCase();
        return hookCommands.some(cmd => lowerMessage.includes(cmd));
    }


    private async handleHookCommand(message: string): Promise<void> {
        if (!this.hookManager) {
            this.addMessage('assistant', 'Hook manager not available.');
            return;
        }

        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('list') || lowerMessage.includes('show') || lowerMessage.includes('status')) {
            const hooks = this.hookManager.getHooks();
            if (hooks.length === 0) {
                this.addMessage('assistant', '📋 No hooks configured yet. Use "create hook" to get started!');
            } else {
                let response = `📋 **Hook Status** (${hooks.length} total):\n\n`;
                hooks.forEach(hook => {
                    const status = hook.isRunning ? '🔄 Running' : 
                                 hook.isActive ? '✅ Active' : '⏸️ Inactive';
                    const mode = hook.executionMode || 'single';
                    const priority = hook.priority || 0;
                    
                    response += `• **${hook.name}** - ${status}\n`;
                    response += `  📂 Pattern: \`${hook.filePattern}\`\n`;
                    response += `  ⚡ Mode: ${mode} (Priority: ${priority})\n`;
                    response += `  📝 ${hook.description}\n\n`;
                });
                this.addMessage('assistant', response);
            }
        } else if (lowerMessage.includes('create') || lowerMessage.includes('new') || lowerMessage.includes('add')) {
            this.addMessage('assistant', '🚀 To create a new hook, use the Hook Manager:\n\n' +
                '1. Open Command Palette (`Cmd+Shift+P`)\n' +
                '2. Run "HookFlow: Open Hook Manager"\n' +
                '3. Click "🚀 Create Hook"\n\n' +
                'Or tell me what you want to automate and I can guide you through the setup!');
        } else {
            this.addMessage('assistant', '🤔 I understand you want to work with hooks. Available commands:\n\n' +
                '• "list hooks" - Show all hooks and their status\n' +
                '• "create hook" - Guide for creating new hooks\n' +
                '• "hook status" - Current hook activity\n\n' +
                'What would you like to do?');
        }

        this.sendHookStatus();
    }


    private getHookStatusSummary(): string {
        if (!this.hookManager) {return 'No hooks available';}
        
        const hooks = this.hookManager.getHooks();
        const active = hooks.filter(h => h.isActive).length;
        const running = hooks.filter(h => h.isRunning).length;
        
        return `${hooks.length} total hooks, ${active} active, ${running} running`;
    }

    

    private addMessage(role: 'user' | 'assistant', content: string): void {
        const message: ChatMessage = {
            id: Date.now().toString(),
            role,
            content,
            timestamp: new Date().toISOString()
        };
        
        this.chatHistory.push(message);
        this.sendMessage('newMessage', message);
    }

    private clearChat(): void {
        this.chatHistory = [];
        this.sendMessage('clearMessages', {});
    }

    private async executeHookById(hookId: string): Promise<void> {
        if (!this.hookManager) {return;}
        
        // This would need to be implemented in HookManager
        this.addMessage('assistant', `🚀 Hook execution requested for: ${hookId}`);
    }

    private async toggleHookById(hookId: string): Promise<void> {
        if (!this.hookManager) {return;}
        
        try {
            await this.hookManager.toggleHookFromWebview(hookId);
            this.addMessage('assistant', `✅ Hook toggled: ${hookId}`);
            this.sendHookStatus();
        } catch (error) {
            this.addMessage('assistant', `❌ Error toggling hook: ${error}`);
        }
    }

    private async handleToggleMcpTool(toolName: string, enabled: boolean): Promise<void> {
        try {
            console.log(`🔧 Toggling MCP tool ${toolName}: ${enabled}`);
            
            // Get current configuration
            const config = vscode.workspace.getConfiguration('aiAgentHooks.mcp');
            let allowedTools = config.get<string[]>('allowedTools', []);
            
            if (enabled) {
                // Add tool to allowed list
                if (!allowedTools.includes(toolName)) {
                    allowedTools.push(toolName);
                }
            } else {
                // Remove tool from allowed list
                allowedTools = allowedTools.filter(tool => tool !== toolName);
            }
            
            // Update configuration
            await config.update('allowedTools', allowedTools, vscode.ConfigurationTarget.Workspace);
            
            console.log(`✅ Updated MCP tools config:`, allowedTools);
            
            // Refresh MCP tools data and send to webview
            const updatedTools = await this.getMcpToolsData();
            this.sendMessage('mcpToolsUpdated', { mcpTools: updatedTools });
            
            // Show confirmation message in chat
            const action = enabled ? 'enabled' : 'disabled';
            this.addMessage('assistant', `🔧 MCP tool "${toolName}" has been ${action} for this workspace.`);
            
        } catch (error) {
            console.error('Error toggling MCP tool:', error);
            this.addMessage('assistant', `❌ Error toggling MCP tool "${toolName}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private sendChatHistory(): void {
        this.sendMessage('chatHistory', { messages: this.chatHistory });
    }

    private sendHookStatus(): void {
        if (!this.hookManager) {return;}
        
        const hooks = this.hookManager.getHooks();
        this.sendMessage('hookStatus', { hooks });
    }

    private sendMessage(command: string, data: any): void {
        if (this._panel) {
            this._panel.webview.postMessage({ command, ...data });
        }
    }

    private getHtmlForWebview(): string {
        // Use external file approach like HookManagerProvider for reliability
        console.log('📄 Using external file approach for Vibe HTML');
        return this.getFallbackVibeHtml();
    }


    private getFallbackVibeHtml(): string {
        const scriptUri = this._panel?.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'assets', 'vibe.js')
        ) || '';
        
        const styleUri = this._panel?.webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview', 'assets', 'vibe.css')
        ) || '';

        console.log(`📄 Creating Vibe HTML with external assets`);
        console.log(`🎨 Style URI: ${styleUri}`);
        console.log(`⚙️ Script URI: ${scriptUri}`);
        
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${this._panel?.webview.cspSource}; script-src 'unsafe-inline' ${this._panel?.webview.cspSource};">
    <title>Vibe Mode - AI Agent Hooks</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="app">
        <!-- Header -->
        <div class="vibe-header">
            <div class="vibe-title">
                <span class="vibe-icon">💡</span>
                <h1>Vibe Mode</h1>
            </div>
            <div class="connection-status" id="connectionStatus">
                <span class="status-indicator offline"></span>
                <span class="status-text">Disconnected</span>
            </div>
        </div>

        <!-- Main Content -->
        <div class="vibe-content">
            <!-- Chat Window -->
            <div class="chat-section">
                <div class="chat-container">
                    <div class="messages" id="chatMessages">
                        <div class="system-message">
                            <span class="system-icon">🤖</span>
                            <div class="message-content">
                                Welcome to Vibe Mode! I can help you manage hooks, analyze your code, and provide insights using MCP tools.
                            </div>
                        </div>
                    </div>
                    
                    <div class="input-container">
                        <div class="input-wrapper">
                            <input type="text" 
                                   id="chatInput" 
                                   placeholder="Ask about hooks, code analysis, or project insights..."
                                   autocomplete="off">
                            <button id="sendButton" type="button">
                                <span class="send-icon">→</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Hook Visualization Panel -->
            <div class="visualization-section">
                <div class="panel-header">
                    <h2>Hook Activity</h2>
                    <div class="refresh-button" id="refreshHooks">↻</div>
                </div>
                
                <div class="hook-activity" id="hookActivity">
                    <div class="activity-item">
                        <span class="activity-status idle">●</span>
                        <span class="activity-text">No hooks running</span>
                    </div>
                </div>

                <div class="hook-list" id="hookList">
                    <!-- Hook items will be populated dynamically -->
                </div>

                <!-- Quick Actions -->
                <div class="quick-actions">
                    <button class="action-btn" id="createHookBtn">
                        <span>+</span> New Hook
                    </button>
                    <button class="action-btn" id="manageHooksBtn">
                        <span>⚙</span> Manage
                    </button>
                </div>
            </div>
        </div>

        <!-- MCP Tools Panel -->
        <div class="mcp-tools" id="mcpTools">
            <div class="tools-header">
                <h3>Available MCP Tools</h3>
                <div class="tools-toggle" id="toolsToggle">▼</div>
            </div>
            <div class="tools-list" id="toolsList">
                <!-- Tools will be populated dynamically -->
            </div>
        </div>
    </div>

    <!-- Loading Overlay -->
    <div class="loading-overlay" id="loadingOverlay">
        <div class="spinner"></div>
        <div class="loading-text">Processing...</div>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
    }
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}