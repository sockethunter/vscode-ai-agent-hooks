import { AIProvider, AIProviderConfig, AIResponse } from './aiProvider';

export class AnthropicProvider extends AIProvider {
    constructor(config: AIProviderConfig) {
        super(config);
    }

    getName(): string {
        return 'Anthropic';
    }

    getDefaultModel(): string {
        return this.config.model || 'claude-3-sonnet-20240229';
    }

    async sendMessage(prompt: string): Promise<AIResponse> {
        const response = await fetch(this.config.baseUrl || 'https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.getDefaultModel(),
                max_tokens: this.config.maxTokens || 2000,
                messages: [{ role: 'user', content: prompt }],
                temperature: this.config.temperature || 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.statusText}`);
        }

        const data = await response.json() as any;
        return {
            content: data.content[0].text,
            usage: {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens
            }
        };
    }

    validateConfig(): boolean {
        return !!this.config.apiKey;
    }
}