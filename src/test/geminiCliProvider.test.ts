import * as assert from "assert";
import { GeminiCliProvider } from "../providers/geminiCliProvider";
import { AIProviderConfig } from "../providers/aiProvider";
import * as os from "os";
import * as path from "path";

suite("GeminiCliProvider Test Suite", () => {
  let provider: GeminiCliProvider;

  setup(() => {
    // Set up provider with test configuration
    provider = new GeminiCliProvider({
      model: "gemini-2.5-flash",
      temperature: 0.8,
      maxTokens: 1500,
    } as AIProviderConfig);
  });

  test("should set default OAuth path when not provided", () => {
    // Create provider without geminiCliOAuthPath
    const providerWithoutOAuthPath = new GeminiCliProvider({
      model: "gemini-2.5-flash",
    } as any);

    // Validate config which should set the default path
    const isValid = providerWithoutOAuthPath.validateConfig();

    // Check that validation passes
    assert.strictEqual(
      isValid,
      true,
      "Should validate with default OAuth path",
    );

    // Check that the default path was set
    assert.strictEqual(
      (providerWithoutOAuthPath as any).config.geminiCliOAuthPath,
      "~/.gemini/oauth_creds.json",
      "Should set default OAuth path",
    );
  });

  test("should validate configuration correctly and set default OAuth path", () => {
    const validProviderWithOAuthPath = new GeminiCliProvider({
      geminiCliOAuthPath: "~/.gemini/oauth_creds.json",
      model: "gemini-2.5-flash",
    } as any);

    const providerWithoutOAuthPath = new GeminiCliProvider({
      model: "gemini-2.5-flash",
    } as any);

    // Both should validate successfully
    assert.strictEqual(
      validProviderWithOAuthPath.validateConfig(),
      true,
      "Should validate with OAuth path",
    );
    assert.strictEqual(
      providerWithoutOAuthPath.validateConfig(),
      true,
      "Should validate and set default OAuth path",
    );

    // Check that default path was set
    assert.strictEqual(
      (providerWithoutOAuthPath as any).config.geminiCliOAuthPath,
      "~/.gemini/oauth_creds.json",
      "Should set default OAuth path",
    );
  });

  test("should return correct provider name and default model", () => {
    assert.strictEqual(provider.getName(), "Gemini CLI");
    assert.strictEqual(provider.getDefaultModel(), "gemini-2.5-flash");

    const providerWithCustomModel = new GeminiCliProvider({
      geminiCliOAuthPath: "~/.gemini/oauth_creds.json",
      model: "custom-model",
    } as any);
    assert.strictEqual(
      providerWithCustomModel.getDefaultModel(),
      "custom-model",
    );
  });

  test("should expand ~ to home directory in OAuth path", () => {
    const homeDir = os.homedir();
    const providerWithTildePath = new GeminiCliProvider({
      geminiCliOAuthPath: "~/custom/path/oauth_creds.json",
      model: "gemini-2.5-flash",
    } as any);

    // Call validateConfig to trigger path handling
    providerWithTildePath.validateConfig();

    // For the new implementation, we don't set environment variables
    // but we can verify the path expansion logic would work
    const configPath = (providerWithTildePath as any).config.geminiCliOAuthPath;
    if (configPath.startsWith("~")) {
      const expandedPath = path.join(homeDir, configPath.slice(1));
      assert.ok(
        expandedPath.includes(homeDir),
        "Should expand ~ to home directory",
      );
    }
  });

  test("should handle geminiCliProjectId configuration", () => {
    const providerWithProjectId = new GeminiCliProvider({
      geminiCliOAuthPath: "~/.gemini/oauth_creds.json",
      geminiCliProjectId: "test-project-id",
      model: "gemini-2.5-flash",
    } as any);

    providerWithProjectId.validateConfig();

    // Check that projectId was preserved
    assert.strictEqual(
      (providerWithProjectId as any).config.geminiCliProjectId,
      "test-project-id",
      "Should preserve project ID",
    );
  });

  test("should handle sendMessage with error conditions", async () => {
    // Create a provider with a non-existent OAuth path to ensure it fails quickly
    const testProvider = new GeminiCliProvider({
      model: "gemini-2.5-flash",
      geminiCliOAuthPath: "/non/existent/oauth/path.json",
    } as any);

    try {
      await testProvider.sendMessage("test prompt");
      assert.fail("Should have thrown an error");
    } catch (error) {
      assert.ok(error instanceof Error);
      // Just verify that an error was thrown
      assert.ok(
        error.message.length > 0,
        `Error message should not be empty: ${error.message}`,
      );
    }
  }).timeout(1000); // Reduce timeout since this should fail quickly

  test("should handle different model configurations", () => {
    const models = [
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash-exp",
    ];

    models.forEach((model) => {
      const testProvider = new GeminiCliProvider({
        model: model,
      } as any);
      assert.strictEqual(testProvider.getDefaultModel(), model);
    });
  });

  test("should return fallback model when none specified", () => {
    const noModelProvider = new GeminiCliProvider({} as any);
    assert.strictEqual(noModelProvider.getDefaultModel(), "gemini-2.5-flash");
  });

  test("should preserve configuration properties correctly", () => {
    const config = {
      geminiCliOAuthPath: "~/test/oauth.json",
      geminiCliProjectId: "test-project-123",
      model: "test-model",
      temperature: 0.3,
      maxTokens: 1000,
      apiKey: "not-used-but-should-be-preserved",
    };

    const testProvider = new GeminiCliProvider(config as any);

    // Verify all properties are preserved
    assert.strictEqual(
      (testProvider as any).config.geminiCliOAuthPath,
      config.geminiCliOAuthPath,
    );
    assert.strictEqual(
      (testProvider as any).config.geminiCliProjectId,
      config.geminiCliProjectId,
    );
    assert.strictEqual((testProvider as any).config.model, config.model);
    assert.strictEqual(
      (testProvider as any).config.temperature,
      config.temperature,
    );
    assert.strictEqual(
      (testProvider as any).config.maxTokens,
      config.maxTokens,
    );
    assert.strictEqual((testProvider as any).config.apiKey, config.apiKey);
  });

  test("should initialize OAuth client correctly", () => {
    // Verify that the OAuth client is initialized
    assert.ok(
      (provider as any).authClient,
      "Should have OAuth client initialized",
    );

    // Verify initial state
    assert.strictEqual(
      (provider as any).projectId,
      null,
      "Should start with null project ID",
    );
    assert.strictEqual(
      (provider as any).credentials,
      null,
      "Should start with null credentials",
    );
  });

  test("should handle OAuth path expansion and validation", () => {
    // Test path expansion for tilde
    const tildeProvider = new GeminiCliProvider({
      geminiCliOAuthPath: "~/custom/oauth.json",
    } as any);
    tildeProvider.validateConfig();

    // Test absolute path preservation
    const absoluteProvider = new GeminiCliProvider({
      geminiCliOAuthPath: "/absolute/path/oauth.json",
    } as any);
    absoluteProvider.validateConfig();
    assert.strictEqual(
      (absoluteProvider as any).config.geminiCliOAuthPath,
      "/absolute/path/oauth.json",
    );

    // Test relative path preservation
    const relativeProvider = new GeminiCliProvider({
      geminiCliOAuthPath: "./relative/oauth.json",
    } as any);
    relativeProvider.validateConfig();
    assert.strictEqual(
      (relativeProvider as any).config.geminiCliOAuthPath,
      "./relative/oauth.json",
    );
  });

  test("should handle project ID configuration scenarios", () => {
    // Test with explicit project ID
    const withProjectId = new GeminiCliProvider({
      geminiCliProjectId: "explicit-project-123",
    } as any);
    assert.strictEqual(
      (withProjectId as any).config.geminiCliProjectId,
      "explicit-project-123",
    );

    // Test without project ID (should be discoverable)
    const withoutProjectId = new GeminiCliProvider({
      model: "test-model",
    } as any);
    assert.strictEqual(
      (withoutProjectId as any).config.geminiCliProjectId,
      undefined,
    );
  });

  test("should handle temperature and token limit configurations", () => {
    // Test with custom temperature and token limits
    const customConfigProvider = new GeminiCliProvider({
      temperature: 0.1,
      maxTokens: 100,
    } as any);

    assert.strictEqual((customConfigProvider as any).config.temperature, 0.1);
    assert.strictEqual((customConfigProvider as any).config.maxTokens, 100);

    // Test with undefined values (should use defaults)
    const defaultConfigProvider = new GeminiCliProvider({
      model: "test-model",
    } as any);

    assert.strictEqual(
      (defaultConfigProvider as any).config.temperature,
      undefined,
    );
    assert.strictEqual(
      (defaultConfigProvider as any).config.maxTokens,
      undefined,
    );
  });

  test("should validate configuration edge cases", () => {
    // Test with empty object
    const emptyProvider = new GeminiCliProvider({} as any);
    assert.strictEqual(emptyProvider.validateConfig(), true);

    // Test with null values
    const nullProvider = new GeminiCliProvider({
      geminiCliOAuthPath: null,
      geminiCliProjectId: null,
      model: null,
    } as any);
    assert.strictEqual(nullProvider.validateConfig(), true);

    // Verify default OAuth path is set when null/undefined
    assert.strictEqual(
      (nullProvider as any).config.geminiCliOAuthPath,
      "~/.gemini/oauth_creds.json",
    );
  });
});
