import { AIProvider, AIProviderConfig, AIResponse } from './aiProvider';

export class OpenAIProvider extends AIProvider {
    constructor(config: AIProviderConfig) {
        super(config);
    }

    getName(): string {
        return 'OpenAI';
    }

    getDefaultModel(): string {
        return this.config.model || 'gpt-4';
    }

    async sendMessage(prompt: string): Promise<AIResponse> {
        const response = await fetch(this.config.baseUrl || 'https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.getDefaultModel(),
                messages: [{ role: 'user', content: prompt }],
                max_tokens: this.config.maxTokens || 2000,
                temperature: this.config.temperature || 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.choices[0].message.content,
            usage: {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            }
        };
    }

    validateConfig(): boolean {
        return !!this.config.apiKey;
    }
}