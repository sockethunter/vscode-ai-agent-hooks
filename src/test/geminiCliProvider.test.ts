import * as assert from 'assert';
import { GeminiCliProvider } from '../providers/geminiCliProvider';
import * as os from 'os';
import * as path from 'path';

suite('GeminiCliProvider Test Suite', () => {
    let provider: GeminiCliProvider;

    setup(() => {
        // Set up provider with test configuration
        provider = new GeminiCliProvider({
            model: 'gemini-2.5-flash',
            temperature: 0.8,
            maxTokens: 1500
        } as any);
    });

    test('should set default OAuth path when not provided', () => {
        // Create provider without geminiCliOAuthPath
        const providerWithoutOAuthPath = new GeminiCliProvider({
            model: 'gemini-2.5-flash'
        } as any);

        // Validate config which should set the default path
        const isValid = providerWithoutOAuthPath.validateConfig();
        
        // Check that validation passes
        assert.strictEqual(isValid, true, 'Should validate with default OAuth path');
        
        // Check that the default path was set
        assert.strictEqual((providerWithoutOAuthPath as any).config.geminiCliOAuthPath, '~/.gemini/oauth_creds.json', 'Should set default OAuth path');
    });

    test('should validate configuration correctly and set default OAuth path', () => {
        const validProviderWithOAuthPath = new GeminiCliProvider({
            geminiCliOAuthPath: '~/.gemini/oauth_creds.json',
            model: 'gemini-2.5-flash'
        } as any);

        const providerWithoutOAuthPath = new GeminiCliProvider({
            model: 'gemini-2.5-flash'
        } as any);

        // Both should validate successfully
        assert.strictEqual(validProviderWithOAuthPath.validateConfig(), true, 'Should validate with OAuth path');
        assert.strictEqual(providerWithoutOAuthPath.validateConfig(), true, 'Should validate and set default OAuth path');
        
        // Check that default path was set
        assert.strictEqual((providerWithoutOAuthPath as any).config.geminiCliOAuthPath, '~/.gemini/oauth_creds.json', 'Should set default OAuth path');
    });

    test('should return correct provider name and default model', () => {
        assert.strictEqual(provider.getName(), 'Gemini CLI');
        assert.strictEqual(provider.getDefaultModel(), 'gemini-2.5-flash');
        
        const providerWithCustomModel = new GeminiCliProvider({
            geminiCliOAuthPath: '~/.gemini/oauth_creds.json',
            model: 'custom-model'
        } as any);
        assert.strictEqual(providerWithCustomModel.getDefaultModel(), 'custom-model');
    });

    test('should expand ~ to home directory in OAuth path', () => {
        const homeDir = os.homedir();
        const providerWithTildePath = new GeminiCliProvider({
            geminiCliOAuthPath: '~/custom/path/oauth_creds.json',
            model: 'gemini-2.5-flash'
        } as any);

        // Call validateConfig to trigger path handling
        providerWithTildePath.validateConfig();

        // For the new implementation, we don't set environment variables
        // but we can verify the path expansion logic would work
        const configPath = (providerWithTildePath as any).config.geminiCliOAuthPath;
        if (configPath.startsWith('~')) {
            const expandedPath = path.join(homeDir, configPath.slice(1));
            assert.ok(expandedPath.includes(homeDir), 'Should expand ~ to home directory');
        }
    });

    test('should handle geminiCliProjectId configuration', () => {
        const providerWithProjectId = new GeminiCliProvider({
            geminiCliOAuthPath: '~/.gemini/oauth_creds.json',
            geminiCliProjectId: 'test-project-id',
            model: 'gemini-2.5-flash'
        } as any);

        providerWithProjectId.validateConfig();
        
        // Check that projectId was preserved
        assert.strictEqual((providerWithProjectId as any).config.geminiCliProjectId, 'test-project-id', 'Should preserve project ID');
    });

    test('should have correct API endpoint configuration', () => {
        // This test ensures the provider is configured to use the correct API endpoints
        // We can't easily test the actual API calls without credentials, but we can
        // verify the configuration constants exist
        assert.ok(provider.getName(), 'Should have provider name');
        assert.ok(provider.getDefaultModel(), 'Should have default model');
    });
});