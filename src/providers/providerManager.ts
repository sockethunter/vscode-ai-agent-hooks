import * as vscode from 'vscode';
import { AIProvider, AIProviderType } from './aiProvider';
import { OpenAIProvider } from './openaiProvider';
import { AnthropicProvider } from './anthropicProvider';
import { OllamaProvider } from './ollamaProvider';

export class ProviderManager {
    private static instance: ProviderManager;
    private currentProvider: AIProvider | null = null;

    static getInstance(): ProviderManager {
        if (!ProviderManager.instance) {
            ProviderManager.instance = new ProviderManager();
        }
        return ProviderManager.instance;
    }

    async selectProvider(): Promise<void> {
        const providerOptions = [
            { label: 'OpenAI', value: AIProviderType.OPENAI },
            { label: 'Anthropic (Claude)', value: AIProviderType.ANTHROPIC },
            { label: 'Ollama (Local)', value: AIProviderType.OLLAMA },
            { label: 'Azure OpenAI', value: AIProviderType.AZURE_OPENAI }
        ];

        const selected = await vscode.window.showQuickPick(
            providerOptions.map(option => ({
                label: option.label,
                description: option.value
            })),
            { placeHolder: 'Wähle einen AI Provider' }
        );

        if (selected) {
            const providerType = selected.description as AIProviderType;
            await this.configureProvider(providerType);
        }
    }

    private async configureProvider(type: AIProviderType): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        
        switch (type) {
            case AIProviderType.OPENAI:
                await this.configureOpenAI(config);
                break;
            case AIProviderType.ANTHROPIC:
                await this.configureAnthropic(config);
                break;
            case AIProviderType.OLLAMA:
                await this.configureOllama(config);
                break;
            case AIProviderType.AZURE_OPENAI:
                await this.configureAzureOpenAI(config);
                break;
        }
    }

    private async configureOpenAI(config: vscode.WorkspaceConfiguration): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'OpenAI API Key eingeben',
            password: true,
            value: config.get('openai.apiKey', '')
        });

        if (!apiKey) return;

        const model = await vscode.window.showQuickPick([
            'gpt-4',
            'gpt-4-turbo',
            'gpt-3.5-turbo'
        ], { placeHolder: 'Modell wählen' });

        await config.update('provider', AIProviderType.OPENAI, true);
        await config.update('openai.apiKey', apiKey, true);
        await config.update('openai.model', model || 'gpt-4', true);

        this.currentProvider = new OpenAIProvider({
            apiKey,
            model: model || 'gpt-4'
        });

        vscode.window.showInformationMessage('OpenAI Provider konfiguriert');
    }

    private async configureAnthropic(config: vscode.WorkspaceConfiguration): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Anthropic API Key eingeben',
            password: true,
            value: config.get('anthropic.apiKey', '')
        });

        if (!apiKey) return;

        const model = await vscode.window.showQuickPick([
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
            'claude-3-opus-20240229'
        ], { placeHolder: 'Modell wählen' });

        await config.update('provider', AIProviderType.ANTHROPIC, true);
        await config.update('anthropic.apiKey', apiKey, true);
        await config.update('anthropic.model', model || 'claude-3-sonnet-20240229', true);

        this.currentProvider = new AnthropicProvider({
            apiKey,
            model: model || 'claude-3-sonnet-20240229'
        });

        vscode.window.showInformationMessage('Anthropic Provider konfiguriert');
    }

    private async configureOllama(config: vscode.WorkspaceConfiguration): Promise<void> {
        const baseUrl = await vscode.window.showInputBox({
            prompt: 'Ollama Base URL eingeben',
            value: config.get('ollama.baseUrl', 'http://localhost:11434')
        });

        const model = await vscode.window.showInputBox({
            prompt: 'Modell Name eingeben',
            value: config.get('ollama.model', 'llama2')
        });

        if (!baseUrl || !model) return;

        await config.update('provider', AIProviderType.OLLAMA, true);
        await config.update('ollama.baseUrl', baseUrl, true);
        await config.update('ollama.model', model, true);

        this.currentProvider = new OllamaProvider({
            apiKey: '', // Not needed for Ollama
            baseUrl,
            model
        });

        vscode.window.showInformationMessage('Ollama Provider konfiguriert');
    }

    private async configureAzureOpenAI(config: vscode.WorkspaceConfiguration): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Azure OpenAI API Key eingeben',
            password: true,
            value: config.get('azureOpenai.apiKey', '')
        });

        const baseUrl = await vscode.window.showInputBox({
            prompt: 'Azure OpenAI Endpoint eingeben',
            value: config.get('azureOpenai.baseUrl', '')
        });

        const model = await vscode.window.showInputBox({
            prompt: 'Deployment Name eingeben',
            value: config.get('azureOpenai.model', '')
        });

        if (!apiKey || !baseUrl || !model) return;

        await config.update('provider', AIProviderType.AZURE_OPENAI, true);
        await config.update('azureOpenai.apiKey', apiKey, true);
        await config.update('azureOpenai.baseUrl', baseUrl, true);
        await config.update('azureOpenai.model', model, true);

        this.currentProvider = new OpenAIProvider({
            apiKey,
            baseUrl: `${baseUrl}/openai/deployments/${model}`,
            model
        });

        vscode.window.showInformationMessage('Azure OpenAI Provider konfiguriert');
    }

    getCurrentProvider(): AIProvider | null {
        return this.currentProvider;
    }

    async initializeFromConfig(): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiAgentHooks');
        const providerType = config.get<AIProviderType>('provider');

        if (!providerType) return;

        try {
            switch (providerType) {
                case AIProviderType.OPENAI:
                    const openaiConfig = {
                        apiKey: config.get<string>('openai.apiKey', ''),
                        model: config.get<string>('openai.model', 'gpt-4')
                    };
                    if (openaiConfig.apiKey) {
                        this.currentProvider = new OpenAIProvider(openaiConfig);
                    }
                    break;

                case AIProviderType.ANTHROPIC:
                    const anthropicConfig = {
                        apiKey: config.get<string>('anthropic.apiKey', ''),
                        model: config.get<string>('anthropic.model', 'claude-3-sonnet-20240229')
                    };
                    if (anthropicConfig.apiKey) {
                        this.currentProvider = new AnthropicProvider(anthropicConfig);
                    }
                    break;

                case AIProviderType.OLLAMA:
                    const ollamaConfig = {
                        apiKey: '',
                        baseUrl: config.get<string>('ollama.baseUrl', 'http://localhost:11434'),
                        model: config.get<string>('ollama.model', 'llama2')
                    };
                    this.currentProvider = new OllamaProvider(ollamaConfig);
                    break;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Fehler beim Initialisieren des AI Providers: ${error}`);
        }
    }
}