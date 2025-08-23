import { AIProvider, AIProviderConfig, AIResponse } from './aiProvider';

// Declare require function to avoid TypeScript errors
declare function require(moduleName: string): any;

export class GeminiCliProvider extends AIProvider {
    constructor(config: AIProviderConfig) {
        super(config);
    }

    getName(): string {
        return 'Gemini CLI';
    }

    getDefaultModel(): string {
        return this.config.model || 'gemini-2.5-pro';
    }

    async sendMessage(prompt: string): Promise<AIResponse> {
        try {
            // Dynamically require child_process and util modules
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execPromise = promisify(exec);
            
            // Construct the command to call the Gemini CLI
            const command = `gemini chat --model ${this.getDefaultModel()} --api-key ${this.config.apiKey} --temperature ${this.config.temperature || 0.7} --max-tokens ${this.config.maxTokens || 2000} --prompt "${prompt.replace(/"/g, '\\"')}"`;
            
            const { stdout, stderr } = await execPromise(command);
            
            if (stderr) {
                throw new Error(`Gemini CLI error: ${stderr}`);
            }
            
            // Parse the response from the CLI
            const response = JSON.parse(stdout);
            
            return {
                content: response.content,
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0
                }
            };
        } catch (error) {
            throw new Error(`Gemini CLI API error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    validateConfig(): boolean {
        return !!this.config.apiKey;
    }
}