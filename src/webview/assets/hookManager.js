class HookManagerUI {
    constructor() {
        this.vscode = acquireVsCodeApi();
        this.editingHookId = null;
        this.availableMcpTools = [];
        this.initializeEventListeners();
        this.requestInitialData();
        this.requestMcpTools();
    }

    initializeEventListeners() {
        // Form submission
        const hookForm = document.getElementById('hookForm');
        if (hookForm) {
            hookForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // MCP toggle handling
        const mcpEnabledCheckbox = document.getElementById('mcpEnabled');
        if (mcpEnabledCheckbox) {
            mcpEnabledCheckbox.addEventListener('change', (e) => this.handleMcpToggle(e));
        }

        // Listen for messages from extension
        window.addEventListener('message', (event) => this.handleMessage(event));
    }

    handleMcpToggle(event) {
        const mcpOptions = document.getElementById('mcpOptions');
        const multiStepCheckbox = document.getElementById('multiStepEnabled');
        
        if (event.target.checked) {
            mcpOptions.style.display = 'block';
            // Auto-enable multi-step when MCP is enabled
            if (multiStepCheckbox) {
                multiStepCheckbox.checked = true;
            }
        } else {
            mcpOptions.style.display = 'none';
        }
    }

    handleFormSubmit(event) {
        event.preventDefault();
        
        const formData = this.getFormData();
        if (!this.validateFormData(formData)) {
            return;
        }

        if (this.editingHookId) {
            // Update existing hook
            this.vscode.postMessage({
                command: 'updateHook',
                hookId: this.editingHookId,
                data: formData
            });
        } else {
            // Create new hook
            this.vscode.postMessage({
                command: 'createHook',
                data: formData
            });
        }

        this.resetForm();
    }

    getFormData() {
        // Get selected MCP tools
        const selectedTools = [];
        const toolCheckboxes = document.querySelectorAll('.mcp-tool-item input[type="checkbox"]:checked');
        toolCheckboxes.forEach(checkbox => {
            selectedTools.push(checkbox.value);
        });

        return {
            name: document.getElementById('hookName')?.value || '',
            naturalLanguage: document.getElementById('naturalLanguage')?.value || '',
            trigger: document.getElementById('trigger')?.value || '',
            filePattern: document.getElementById('filePattern')?.value || '**/*',
            mcpEnabled: document.getElementById('mcpEnabled')?.checked || false,
            multiStepEnabled: document.getElementById('multiStepEnabled')?.checked || false,
            allowedMcpTools: selectedTools
        };
    }

    validateFormData(data) {
        if (!data.name.trim()) {
            this.showError('Hook Name is required');
            return false;
        }
        
        if (!data.naturalLanguage.trim()) {
            this.showError('Description is required');
            return false;
        }
        
        if (!data.trigger) {
            this.showError('Trigger Event is required');
            return false;
        }
        
        return true;
    }

    resetForm() {
        const form = document.getElementById('hookForm');
        if (form) {
            form.reset();
        }
        this.editingHookId = null;
        this.updateFormButtonText();
    }

    updateFormButtonText() {
        const submitButton = document.querySelector('#hookForm button[type="submit"]');
        const cancelButton = document.getElementById('cancelEditBtn');
        
        if (submitButton) {
            submitButton.textContent = this.editingHookId ? '💾 Update Hook' : '🚀 Create Hook';
        }
        
        if (cancelButton) {
            cancelButton.style.display = this.editingHookId ? 'inline-block' : 'none';
        }
    }

    showError(message) {
        // Could implement a proper error display here
        console.error(message);
    }

    requestInitialData() {
        this.vscode.postMessage({ command: 'getHooks' });
    }

    requestMcpTools() {
        this.vscode.postMessage({ command: 'getMcpTools' });
    }

    handleMessage(event) {
        const message = event.data;
        console.log('📨 Received message in WebView:', message);
        
        switch (message.command) {
            case 'updateHooks':
                console.log('🔄 Updating hooks with:', message.hooks);
                this.renderHooks(message.hooks);
                break;
            case 'mcpTools':
                console.log('🔧 Received MCP tools:', message.tools);
                this.renderMcpTools(message.tools);
                break;
            case 'hookCreated':
                console.log('🎉 Hook created, requesting data');
                this.requestInitialData();
                break;
            case 'error':
                console.log('❌ Error message:', message.message);
                this.showError(message.message);
                break;
            default:
                console.log('❓ Unknown message command:', message.command);
        }
    }

    renderHooks(hooks) {
        this.currentHooks = hooks; // Store for edit functionality
        const hooksList = document.getElementById('hooksList');
        const noHooks = document.getElementById('noHooks');

        if (!hooks || hooks.length === 0) {
            if (noHooks) {
                noHooks.style.display = 'block';
            }
            if (hooksList) {
                hooksList.innerHTML = '<p id="noHooks" class="no-hooks">No hooks created yet. Create your first hook above!</p>';
            }
            return;
        }

        if (noHooks) {
            noHooks.style.display = 'none';
        }

        if (hooksList) {
            hooksList.innerHTML = hooks.map(hook => this.createHookHTML(hook)).join('');
        }
    }

    createHookHTML(hook) {
        const statusClass = this.getStatusClass(hook);
        const statusIndicator = this.getStatusIndicatorClass(hook);
        const runningIndicator = hook.isRunning ? '<div class="running-indicator">RUNNING</div>' : '';
        const toggleText = hook.isActive ? '⏸️ Deactivate' : '▶️ Activate';
        const stopButton = hook.isRunning ? 
            `<button onclick="hookManager.stopHook('${hook.id}')" class="danger">⏹️ Stop</button>` : '';
        const lastExecuted = hook.lastExecuted ? 
            `<br><strong>Last executed:</strong> ${this.formatDate(hook.lastExecuted)}` : '';
        
        return `
            <div class="hook-item ${statusClass}">
                ${runningIndicator}
                <div class="hook-header">
                    <div>
                        <span class="status-indicator ${statusIndicator}"></span>
                        <span class="hook-name">${this.escapeHtml(hook.name)}</span>
                    </div>
                    <div class="hook-controls">
                        <button onclick="hookManager.toggleHook('${hook.id}')" class="secondary">
                            ${toggleText}
                        </button>
                        ${stopButton}
                        <button onclick="hookManager.editHook('${hook.id}')" class="secondary">
                            ✏️ Edit
                        </button>
                        <button onclick="hookManager.deleteHook('${hook.id}')" class="danger">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                <div class="hook-description">${this.escapeHtml(hook.description)}</div>
                <div class="hook-trigger">
                    <strong>Trigger:</strong> ${this.escapeHtml(hook.trigger)}
                    ${lastExecuted}
                </div>
                ${this.createMcpStatusHTML(hook)}
            </div>
        `;
    }

    getStatusClass(hook) {
        if (hook.isRunning) return 'running';
        return hook.isActive ? 'active' : 'inactive';
    }

    getStatusIndicatorClass(hook) {
        if (hook.isRunning) return 'status-running';
        return hook.isActive ? 'status-active' : 'status-inactive';
    }

    createMcpStatusHTML(hook) {
        if (!hook.mcpEnabled) {
            return '<div class="hook-mcp-status mcp-disabled">🔧 Standard Hook (simple prompt-response)</div>';
        }

        const toolsText = hook.allowedMcpTools && hook.allowedMcpTools.length > 0 
            ? `Tools: ${hook.allowedMcpTools.join(', ')}`
            : 'No specific tools configured';
        
        const multiStepText = hook.multiStepEnabled ? '⚡ Multi-step execution enabled' : '⚡ Single-step execution';
        
        return `
            <div class="hook-mcp-status mcp-enabled">
                🔧 <strong>MCP Enabled</strong> - Advanced reasoning with project context<br>
                ${multiStepText}<br>
                <small>${toolsText}</small>
            </div>
        `;
    }

    formatDate(dateString) {
        try {
            return new Date(dateString).toLocaleString();
        } catch {
            return dateString;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public methods for button clicks
    toggleHook(hookId) {
        this.vscode.postMessage({
            command: 'toggleHook',
            hookId: hookId
        });
    }

    deleteHook(hookId) {
        if (confirm('Really delete this hook?')) {
            this.vscode.postMessage({
                command: 'deleteHook',
                hookId: hookId
            });
        }
    }

    stopHook(hookId) {
        this.vscode.postMessage({
            command: 'stopHook',
            hookId: hookId
        });
    }

    editHook(hookId) {
        // Find hook in current hooks list
        const hooks = this.currentHooks || [];
        const hook = hooks.find(h => h.id === hookId);
        
        if (!hook) {
            this.showError('Hook not found');
            return;
        }

        // Populate form with hook data (including MCP settings)
        this.populateFormForEdit(hook);

        // Set editing mode
        this.editingHookId = hookId;
        this.updateFormButtonText();

        // Scroll to form
        const form = document.getElementById('hookForm');
        if (form) {
            form.scrollIntoView({ behavior: 'smooth' });
        }
    }

    cancelEdit() {
        this.resetForm();
    }

    renderMcpTools(toolsData) {
        this.availableMcpTools = toolsData;
        const container = document.getElementById('mcpToolsContainer');
        
        if (!container) return;
        
        if (!toolsData || !toolsData.available || toolsData.available.length === 0) {
            container.innerHTML = '<p class="loading">No MCP tools available for this project.</p>';
            return;
        }

        const toolsHTML = toolsData.available.map(toolName => {
            const description = toolsData.descriptions[toolName] || 'No description available';
            const isRecommended = toolsData.recommended.includes(toolName);
            
            return `
                <div class="mcp-tool-item">
                    <input type="checkbox" 
                           id="tool_${toolName}" 
                           value="${toolName}"
                           ${isRecommended ? 'checked' : ''}>
                    <label for="tool_${toolName}" class="mcp-tool-label">
                        <div class="mcp-tool-name">${toolName} ${isRecommended ? '⭐' : ''}</div>
                        <div class="mcp-tool-description">${description}</div>
                    </label>
                </div>
            `;
        }).join('');

        container.innerHTML = toolsHTML;
    }

    populateFormForEdit(hook) {
        // Existing form population...
        document.getElementById('hookName').value = hook.name || '';
        document.getElementById('naturalLanguage').value = hook.naturalLanguage || hook.description || '';
        document.getElementById('trigger').value = hook.trigger || '';
        document.getElementById('filePattern').value = hook.filePattern || '';
        
        // MCP-specific form population
        const mcpEnabled = document.getElementById('mcpEnabled');
        const multiStepEnabled = document.getElementById('multiStepEnabled');
        const mcpOptions = document.getElementById('mcpOptions');
        
        if (mcpEnabled) {
            mcpEnabled.checked = hook.mcpEnabled || false;
        }
        
        if (multiStepEnabled) {
            multiStepEnabled.checked = hook.multiStepEnabled || false;
        }
        
        // Show/hide MCP options based on mcpEnabled
        if (mcpOptions) {
            mcpOptions.style.display = hook.mcpEnabled ? 'block' : 'none';
        }
        
        // Select the hook's allowed tools
        if (hook.allowedMcpTools && hook.allowedMcpTools.length > 0) {
            hook.allowedMcpTools.forEach(toolName => {
                const checkbox = document.getElementById(`tool_${toolName}`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
    }
}

// Global functions for HTML onclick handlers
function showExamples() {
    const examples = document.getElementById('examples');
    if (examples) {
        examples.style.display = examples.style.display === 'none' ? 'block' : 'none';
    }
}

// Initialize the UI when DOM is loaded
let hookManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        hookManager = new HookManagerUI();
    });
} else {
    hookManager = new HookManagerUI();
}
