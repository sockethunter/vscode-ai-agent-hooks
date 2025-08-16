import { AIProvider, AIProviderConfig, AIResponse } from './aiProvider';

export class OllamaProvider extends AIProvider {
    constructor(config: AIProviderConfig) {
        super(config);
    }

    getName(): string {
        return 'Ollama';
    }

    getDefaultModel(): string {
        return this.config.model || 'llama2';
    }

    async sendMessage(prompt: string): Promise<AIResponse> {
        const response = await fetch(`${this.config.baseUrl || 'http://localhost:11434'}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.getDefaultModel(),
                prompt: prompt,
                stream: false,
                options: {
                    temperature: this.config.temperature || 0.7,
                    num_predict: this.config.maxTokens || 2000
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.response,
            usage: {
                promptTokens: data.prompt_eval_count || 0,
                completionTokens: data.eval_count || 0,
                totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
            }
        };
    }

    validateConfig(): boolean {
        return true; // Ollama doesn't require API key
    }
}