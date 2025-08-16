class HookManagerUI {
    constructor() {
        this.vscode = acquireVsCodeApi();
        this.initializeEventListeners();
        this.requestInitialData();
    }

    initializeEventListeners() {
        // Form submission
        const hookForm = document.getElementById('hookForm');
        if (hookForm) {
            hookForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Listen for messages from extension
        window.addEventListener('message', (event) => this.handleMessage(event));
    }

    handleFormSubmit(event) {
        event.preventDefault();
        
        const formData = this.getFormData();
        if (!this.validateFormData(formData)) {
            return;
        }

        this.vscode.postMessage({
            command: 'createHook',
            data: formData
        });

        this.resetForm();
    }

    getFormData() {
        return {
            name: document.getElementById('hookName')?.value || '',
            naturalLanguage: document.getElementById('naturalLanguage')?.value || '',
            trigger: document.getElementById('trigger')?.value || '',
            filePattern: document.getElementById('filePattern')?.value || '**/*'
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
    }

    showError(message) {
        // Could implement a proper error display here
        console.error(message);
    }

    requestInitialData() {
        this.vscode.postMessage({ command: 'getHooks' });
    }

    handleMessage(event) {
        const message = event.data;
        
        switch (message.command) {
            case 'updateHooks':
                this.renderHooks(message.hooks);
                break;
            case 'hookCreated':
                this.requestInitialData();
                break;
            case 'error':
                this.showError(message.message);
                break;
        }
    }

    renderHooks(hooks) {
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
