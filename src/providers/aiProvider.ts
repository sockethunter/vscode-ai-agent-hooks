export interface AIProviderConfig {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface AIResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export abstract class AIProvider {
    protected config: AIProviderConfig;
    
    constructor(config: AIProviderConfig) {
        this.config = config;
    }

    abstract getName(): string;
    abstract getDefaultModel(): string;
    abstract sendMessage(prompt: string): Promise<AIResponse>;
    abstract validateConfig(): boolean;
}

export enum AIProviderType {
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    OLLAMA = 'ollama',
    AZURE_OPENAI = 'azure-openai',
    GEMINI_CLI = 'gemini-cli',
}