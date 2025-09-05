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

  async generateResponse(prompt: string): Promise<string> {
    const response = await this.sendMessage(prompt);
    console.log("📝 Generated response", response);
    return response.content;
  }
}

export enum AIProviderType {
  OPENAI = "openai",
  ANTHROPIC = "anthropic",
  OLLAMA = "ollama",
  AZURE_OPENAI = "azure-openai",
}
