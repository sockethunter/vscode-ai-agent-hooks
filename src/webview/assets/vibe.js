// Vibe Mode JavaScript
class VibeMode {
    constructor() {
        this.vscode = acquireVsCodeApi();
        this.isConnected = false;
        this.hooks = [];
        this.mcpTools = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.initialize();
    }

    initializeElements() {
        // Main elements
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.chatMessages = document.getElementById('chatMessages');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Hook visualization
        this.hookActivity = document.getElementById('hookActivity');
        this.hookList = document.getElementById('hookList');
        this.refreshHooks = document.getElementById('refreshHooks');
        
        // Actions
        this.createHookBtn = document.getElementById('createHookBtn');
        this.manageHooksBtn = document.getElementById('manageHooksBtn');
        
        // MCP Tools
        this.mcpTools = document.getElementById('mcpTools');
        this.toolsList = document.getElementById('toolsList');
        this.toolsToggle = document.getElementById('toolsToggle');
    }

    setupEventListeners() {
        // Chat input
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // Hook management
        this.refreshHooks.addEventListener('click', () => {
            this.refreshHookData();
        });

        this.createHookBtn.addEventListener('click', () => {
            this.vscode.postMessage({
                command: 'openHookManager'
            });
        });

        this.manageHooksBtn.addEventListener('click', () => {
            this.vscode.postMessage({
                command: 'openHookManager'
            });
        });

        // MCP Tools toggle
        this.toolsToggle.addEventListener('click', () => {
            this.toggleMcpTools();
        });

        // Message handling from VS Code
        window.addEventListener('message', (event) => {
            this.handleMessage(event.data);
        });
    }

    initialize() {
        console.log('🚀 Initializing Vibe Mode...');
        this.updateConnectionStatus('connecting', 'Connecting...');
        
        // Request initial data
        this.vscode.postMessage({
            command: 'initialize'
        });
    }

    handleMessage(message) {
        console.log('📨 Received message:', message);
        
        switch (message.command) {
            case 'initialized':
                this.handleInitialized(message);
                break;
            case 'newMessage':
                if (message.role === 'assistant') {
                    this.addMessage('ai', message.content);
                    this.setInputState(true); // Re-enable input after AI response
                }
                break;
            case 'aiResponse':
                // Handled via newMessage now to avoid duplicates
                break;
            case 'hookStatus':
                this.updateHooks(message.hooks);
                break;
            case 'chatHistory':
                this.handleChatHistory(message.messages);
                break;
            case 'clearMessages':
                this.clearChat();
                break;
            case 'connectionStatus':
                this.updateConnectionStatus(message.status, message.message);
                break;
            case 'mcpToolsUpdated':
                this.updateMcpTools(message.mcpTools);
                break;
            case 'error':
                this.handleError(message.error);
                break;
            default:
                console.log('Unknown message command:', message.command);
        }
    }

    handleInitialized(data) {
        console.log('✅ Vibe Mode initialized');
        this.updateConnectionStatus('online', 'Connected');
        
        if (data.hooks) {
            this.updateHooks(data.hooks);
        }
        
        if (data.mcpTools) {
            this.updateMcpTools(data.mcpTools);
        }
        
        this.hideLoading();
    }

    handleChatHistory(messages) {
        if (!messages || messages.length === 0) {return;}
        
        // Clear existing messages except system message
        const systemMessages = this.chatMessages.querySelectorAll('.system-message');
        this.chatMessages.innerHTML = '';
        
        // Re-add system messages
        systemMessages.forEach(sysMsg => {
            this.chatMessages.appendChild(sysMsg.cloneNode(true));
        });
        
        // Add chat history
        messages.forEach(msg => {
            this.addMessage(msg.role === 'user' ? 'user' : 'ai', msg.content);
        });
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) {return;}

        // Add user message to chat
        this.addMessage('user', message);
        
        // Clear input
        this.chatInput.value = '';
        
        // Disable input while processing
        this.setInputState(false);
        
        // Send to VS Code
        this.vscode.postMessage({
            command: 'sendMessage',
            message: message
        });
    }

    handleAiResponse(response) {
        this.addMessage('ai', response);
        this.setInputState(true);
    }

    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message message`;
        
        if (type === 'user') {
            messageDiv.innerHTML = `
                <div class="message-content">${this.escapeHtml(content)}</div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">${this.formatAiResponse(content)}</div>
            `;
        }
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    formatAiResponse(content) {
        // Basic markdown-like formatting
        return this.escapeHtml(content)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px;">$1</code>')
            .replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    setInputState(enabled) {
        this.chatInput.disabled = !enabled;
        this.sendButton.disabled = !enabled;
        
        if (enabled) {
            this.chatInput.focus();
        }
    }

    updateHooks(hooks) {
        this.hooks = hooks;
        this.renderHooks();
        this.updateActivity();
    }

    renderHooks() {
        if (this.hooks.length === 0) {
            this.hookList.innerHTML = `
                <div class="hook-item">
                    <div class="hook-info">
                        <div class="hook-name">No hooks found</div>
                        <div class="hook-status">Create your first hook to get started</div>
                    </div>
                </div>
            `;
            return;
        }

        this.hookList.innerHTML = this.hooks.map(hook => `
            <div class="hook-item" data-hook-id="${hook.id}">
                <div class="hook-info">
                    <div class="hook-name">${this.escapeHtml(hook.name)}</div>
                    <div class="hook-status">
                        ${hook.isActive ? (hook.isRunning ? 'Running' : 'Active') : 'Inactive'}
                        ${hook.lastExecuted ? ` • Last: ${new Date(hook.lastExecuted).toLocaleTimeString()}` : ''}
                    </div>
                </div>
                <div class="hook-controls">
                    <button class="control-btn" onclick="vibeMode.toggleHook('${hook.id}')">
                        ${hook.isActive ? '⏸' : '▶'}
                    </button>
                    ${hook.isRunning ? `
                        <button class="control-btn" onclick="vibeMode.stopHook('${hook.id}')">⏹</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    updateActivity() {
        const runningHooks = this.hooks.filter(hook => hook.isRunning);
        const activeHooks = this.hooks.filter(hook => hook.isActive);
        
        let statusClass = 'idle';
        let statusText = 'No hooks running';
        
        if (runningHooks.length > 0) {
            statusClass = 'running';
            statusText = `${runningHooks.length} hook${runningHooks.length > 1 ? 's' : ''} running`;
        } else if (activeHooks.length > 0) {
            statusText = `${activeHooks.length} hook${activeHooks.length > 1 ? 's' : ''} active`;
        }
        
        this.hookActivity.innerHTML = `
            <div class="activity-item">
                <span class="activity-status ${statusClass}">●</span>
                <span class="activity-text">${statusText}</span>
            </div>
        `;
    }

    updateMcpTools(tools) {
        this.mcpTools = tools;
        this.renderMcpTools();
    }

    renderMcpTools() {
        if (!this.mcpTools || this.mcpTools.length === 0) {
            this.toolsList.innerHTML = `
                <div class="tool-item">No MCP tools available</div>
            `;
            return;
        }

        this.toolsList.innerHTML = this.mcpTools.map(tool => `
            <div class="tool-config-item">
                <label class="tool-checkbox">
                    <input type="checkbox" 
                           id="tool-${tool.name}" 
                           ${tool.enabled ? 'checked' : ''}
                           onchange="vibeMode.toggleTool('${tool.name}', this.checked)">
                    <span class="tool-name">${this.escapeHtml(tool.name)}</span>
                </label>
                <div class="tool-description">${this.escapeHtml(tool.description || 'No description')}</div>
                ${!tool.enabled ? '<div class="tool-status disabled">Disabled</div>' : ''}
            </div>
        `).join('');
    }

    toggleMcpTools() {
        const isCollapsed = this.toolsList.classList.contains('collapsed');
        
        if (isCollapsed) {
            this.toolsList.classList.remove('collapsed');
            this.toolsToggle.classList.remove('collapsed');
        } else {
            this.toolsList.classList.add('collapsed');
            this.toolsToggle.classList.add('collapsed');
        }
    }

    toggleHook(hookId) {
        this.vscode.postMessage({
            command: 'toggleHook',
            hookId: hookId
        });
    }

    stopHook(hookId) {
        this.vscode.postMessage({
            command: 'stopHook',
            hookId: hookId
        });
    }

    toggleTool(toolName, enabled) {
        console.log(`🔧 Toggling tool ${toolName}: ${enabled}`);
        
        // Send message to VS Code to update tool configuration
        this.vscode.postMessage({
            command: 'toggleMcpTool',
            toolName: toolName,
            enabled: enabled
        });
        
        // Update local state
        const tool = this.mcpTools.find(t => t.name === toolName);
        if (tool) {
            tool.enabled = enabled;
        }
        
        // Re-render to update UI
        this.renderMcpTools();
    }

    refreshHookData() {
        this.vscode.postMessage({
            command: 'refreshHooks'
        });
    }

    clearChat() {
        this.chatMessages.innerHTML = `
            <div class="system-message">
                <span class="system-icon">🤖</span>
                <div class="message-content">
                    Chat cleared! How can I help you with your hooks or project?
                </div>
            </div>
        `;
        
        this.vscode.postMessage({
            command: 'clearChat'
        });
    }

    updateConnectionStatus(status, message) {
        const statusIndicator = this.connectionStatus.querySelector('.status-indicator');
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        // Reset classes
        statusIndicator.className = 'status-indicator';
        
        // Add appropriate class
        statusIndicator.classList.add(status);
        statusText.textContent = message;
        
        this.isConnected = status === 'online';
    }

    showLoading() {
        this.loadingOverlay.classList.add('show');
    }

    hideLoading() {
        this.loadingOverlay.classList.remove('show');
    }

    handleError(error) {
        console.error('❌ Vibe Mode Error:', error);
        this.addMessage('ai', `❌ Error: ${error}`);
        this.setInputState(true);
        this.updateConnectionStatus('offline', 'Error occurred');
    }
}

// Initialize when DOM is loaded
let vibeMode;

function initializeVibeMode() {
    console.log('🔄 Initializing Vibe Mode instance...');
    try {
        vibeMode = new VibeMode();
        console.log('✅ Vibe Mode instance created successfully');
    } catch (error) {
        console.error('❌ Error creating Vibe Mode instance:', error);
    }
}

// Try multiple initialization methods
if (document.readyState === 'loading') {
    console.log('📋 Document still loading, waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', initializeVibeMode);
} else {
    console.log('📋 Document already ready, initializing immediately...');
    initializeVibeMode();
}

console.log('💡 Vibe Mode script loaded, readyState:', document.readyState);