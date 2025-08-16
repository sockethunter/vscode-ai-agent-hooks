import * as assert from 'assert';
import * as vscode from 'vscode';
import { ProviderManager } from '../providers/providerManager';

suite('ProviderManager Test Suite', () => {
    let providerManager: ProviderManager;

    setup(() => {
        // Clear any existing instances
        (ProviderManager as any).instance = undefined;
        providerManager = ProviderManager.getInstance();
    });

    teardown(async () => {
        // Clean up configuration
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        await config.update('provider', undefined, vscode.ConfigurationTarget.Global);
        await config.update('openai.apiKey', undefined, vscode.ConfigurationTarget.Global);
        await config.update('openai.model', undefined, vscode.ConfigurationTarget.Global);
    });

    test('should create ProviderManager singleton', () => {
        assert.ok(providerManager);
        const secondInstance = ProviderManager.getInstance();
        assert.strictEqual(providerManager, secondInstance);
    });

    test('should initialize without current provider', () => {
        const currentProvider = providerManager.getCurrentProvider();
        assert.strictEqual(currentProvider, null);
    });

    test('should initialize from config when provider is configured', async () => {
        // Set up mock configuration
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        await config.update('provider', 'openai', vscode.ConfigurationTarget.Global);
        await config.update('openai.apiKey', 'test-key', vscode.ConfigurationTarget.Global);
        await config.update('openai.model', 'gpt-4', vscode.ConfigurationTarget.Global);

        // Initialize from config
        await providerManager.initializeFromConfig();
        
        const currentProvider = providerManager.getCurrentProvider();
        assert.ok(currentProvider);
        assert.strictEqual(currentProvider.getName(), 'OpenAI');
    });

    test('should handle missing configuration gracefully', async () => {
        // Ensure no configuration is set
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        await config.update('provider', undefined, vscode.ConfigurationTarget.Global);

        // Should not throw
        await providerManager.initializeFromConfig();
        
        const currentProvider = providerManager.getCurrentProvider();
        assert.strictEqual(currentProvider, null);
    });

    test('should handle invalid provider type in config', async () => {
        // Set up invalid configuration
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        await config.update('provider', 'invalid-provider', vscode.ConfigurationTarget.Global);

        // Should not throw but should not set a provider
        await providerManager.initializeFromConfig();
        
        const currentProvider = providerManager.getCurrentProvider();
        assert.strictEqual(currentProvider, null);
    });

    test('should handle OpenAI configuration without API key', async () => {
        // Set up incomplete configuration
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        await config.update('provider', 'openai', vscode.ConfigurationTarget.Global);
        await config.update('openai.model', 'gpt-4', vscode.ConfigurationTarget.Global);
        // No API key set

        // Should not throw but should not set a provider
        await providerManager.initializeFromConfig();
        
        const currentProvider = providerManager.getCurrentProvider();
        assert.strictEqual(currentProvider, null);
    });

    test('should initialize Anthropic provider from config', async () => {
        // Set up Anthropic configuration
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        await config.update('provider', 'anthropic', vscode.ConfigurationTarget.Global);
        await config.update('anthropic.apiKey', 'test-anthropic-key', vscode.ConfigurationTarget.Global);
        await config.update('anthropic.model', 'claude-3-sonnet-20240229', vscode.ConfigurationTarget.Global);

        await providerManager.initializeFromConfig();
        
        const currentProvider = providerManager.getCurrentProvider();
        assert.ok(currentProvider);
        assert.strictEqual(currentProvider.getName(), 'Anthropic');
    });

    test('should initialize Ollama provider from config', async () => {
        // Set up Ollama configuration
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        await config.update('provider', 'ollama', vscode.ConfigurationTarget.Global);
        await config.update('ollama.baseUrl', 'http://localhost:11434', vscode.ConfigurationTarget.Global);
        await config.update('ollama.model', 'llama2', vscode.ConfigurationTarget.Global);

        await providerManager.initializeFromConfig();
        
        const currentProvider = providerManager.getCurrentProvider();
        assert.ok(currentProvider);
        assert.strictEqual(currentProvider.getName(), 'Ollama');
    });

    test('should provide selectProvider method for UI', () => {
        // This method exists for UI interaction
        assert.ok(typeof providerManager.selectProvider === 'function');
    });

    test('should not have current provider after clearing config', async () => {
        // Set up configuration first
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        await config.update('provider', 'openai', vscode.ConfigurationTarget.Global);
        await config.update('openai.apiKey', 'test-key', vscode.ConfigurationTarget.Global);

        await providerManager.initializeFromConfig();
        assert.ok(providerManager.getCurrentProvider());

        // Clear configuration
        await config.update('provider', undefined, vscode.ConfigurationTarget.Global);
        await config.update('openai.apiKey', undefined, vscode.ConfigurationTarget.Global);

        // Create new instance and initialize
        (ProviderManager as any).instance = undefined;
        const newProviderManager = ProviderManager.getInstance();
        await newProviderManager.initializeFromConfig();
        
        assert.strictEqual(newProviderManager.getCurrentProvider(), null);
    });
});