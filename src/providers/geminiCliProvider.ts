import { AIProvider, AIProviderConfig, AIResponse } from './aiProvider';
import { spawn } from 'child_process';

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
            // Construct arguments array to prevent command injection
            // Using the actual Gemini CLI options from help output
            const args = [
                '--model', this.getDefaultModel(),
                '--prompt', prompt  // Use --prompt instead of stdin for this CLI
            ];
            
            // Pass API key via environment variable instead of command line argument
            const env = {
                ...process.env,
                GEMINI_API_KEY: this.config.apiKey
            };
            
            // Spawn the process with arguments array (no shell interpolation)
            const child = spawn('gemini', args, { 
                env,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stdout = '';
            let stderr = '';
            
            // Collect stdout
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            // Collect stderr
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            // Wait for the process to complete
            const exitCode = await new Promise<number>((resolve, reject) => {
                child.on('close', (code) => {
                    resolve(code || 0);
                });
                
                child.on('error', (error) => {
                    reject(new Error(`Failed to spawn Gemini CLI: ${error.message}`));
                });
            });
            
            // Check exit code before processing output
            if (exitCode !== 0) {
                throw new Error(`Gemini CLI exited with code ${exitCode}: ${stderr}`);
            }
            
            // Safely parse JSON output with proper error handling
            let response;
            try {
                response = JSON.parse(stdout);
            } catch (parseError) {
                // If JSON parsing fails, assume the output is plain text response
                response = {
                    content: stdout.trim(),
                    usage: {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0
                    }
                };
            }
            
            return {
                content: response.content || response || '',
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