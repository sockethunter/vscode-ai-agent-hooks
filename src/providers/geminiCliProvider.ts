// This file contains code inspired by or derived from Kilo Code.
// Original Kilo Code is licensed under the Apache License, Version 2.0.
// A copy of the Apache License, Version 2.0 can be found at:
// https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the Apache License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the Apache License for the specific language governing permissions and
// limitations under the License.
//
// Original source: https://github.com/Kilo-Org/kilocode
//
// All modifications and the overall work are licensed under the
// GNU General Public License, Version 3.
// A copy of the GNU General Public License, Version 3 can be found in the
// 'LICENSE' file at the root of this repository.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { AIProvider, AIProviderConfig, AIResponse } from "./aiProvider";
import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as dotenv from "dotenv";

// OAuth2 Configuration

//  OAuth Client ID used to initiate OAuth2Client class.
const OAUTH_CLIENT_ID =
  "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com";

// OAuth Secret value used to initiate OAuth2Client class.
// Note: It's ok to save this in git because this is an installed application
// as described here: https://developers.google.com/identity/protocols/oauth2#installed
// "The process results in a client ID and, in some cases, a client secret,
// which you embed in the source code of your application. (In this context,
// the client secret is obviously not treated as a secret.)"
const OAUTH_CLIENT_SECRET = "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";
const OAUTH_REDIRECT_URI = "http://localhost:45289";

// Code Assist API Configuration
const CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com";
const CODE_ASSIST_API_VERSION = "v1internal";

interface OAuthCredentials {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
}

export class GeminiCliProvider extends AIProvider {
  private authClient: OAuth2Client;
  private projectId: string | null = null;
  private credentials: OAuthCredentials | null = null;

  constructor(config: AIProviderConfig) {
    super(config);
    this.authClient = new OAuth2Client(
      OAUTH_CLIENT_ID,
      OAUTH_CLIENT_SECRET,
      OAUTH_REDIRECT_URI,
    );
  }

  getName(): string {
    return "Gemini CLI";
  }

  getDefaultModel(): string {
    return this.config.model || "gemini-2.5-flash";
  }

  private async loadOAuthCredentials(): Promise<void> {
    try {
      const credPath =
        (this.config as any).geminiCliOAuthPath ||
        path.join(os.homedir(), ".gemini", "oauth_creds.json");
      const expandedPath = credPath.startsWith("~")
        ? path.join(os.homedir(), credPath.slice(1))
        : credPath;
      const credData = await fs.readFile(expandedPath, "utf-8");
      this.credentials = JSON.parse(credData);

      // Set credentials on the OAuth2 client
      if (this.credentials) {
        this.authClient.setCredentials({
          access_token: this.credentials.access_token,
          refresh_token: this.credentials.refresh_token,
          expiry_date: this.credentials.expiry_date,
        });
      }
    } catch (error) {
      throw new Error(
        `Failed to load OAuth credentials: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.credentials) {
      await this.loadOAuthCredentials();
    }

    // Check if token needs refresh
    if (this.credentials && this.credentials.expiry_date < Date.now()) {
      try {
        const { credentials } = await this.authClient.refreshAccessToken();
        if (credentials.access_token) {
          this.credentials = {
            access_token: credentials.access_token!,
            refresh_token:
              credentials.refresh_token || this.credentials.refresh_token,
            token_type: credentials.token_type || "Bearer",
            expiry_date: credentials.expiry_date || Date.now() + 3600 * 1000,
          };
          // Save refreshed credentials back to file
          const credPath =
            (this.config as any).geminiCliOAuthPath ||
            path.join(os.homedir(), ".gemini", "oauth_creds.json");
          const expandedPath = credPath.startsWith("~")
            ? path.join(os.homedir(), credPath.slice(1))
            : credPath;
          await fs.writeFile(
            expandedPath,
            JSON.stringify(this.credentials, null, 2),
          );
        }
      } catch (error) {
        throw new Error(
          `Failed to refresh access token: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Call a Code Assist API endpoint
   */
  private async callEndpoint(
    method: string,
    body: any,
    retryAuth: boolean = true,
  ): Promise<any> {
    try {
      const response = await this.authClient.request({
        url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:${method}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        responseType: "json",
        data: JSON.stringify(body),
      });
      return response.data;
    } catch (error: any) {
      // If we get a 401 and haven't retried yet, try refreshing auth
      if (error.response?.status === 401 && retryAuth) {
        await this.ensureAuthenticated(); // This will refresh the token
        return this.callEndpoint(method, body, false); // Retry without further auth retries
      }

      throw error;
    }
  }

  /**
   * Discover or retrieve the project ID
   */
  private async discoverProjectId(): Promise<string> {
    // If we already have a project ID in config, use it
    if ((this.config as any).geminiCliProjectId) {
      this.projectId = (this.config as any).geminiCliProjectId;
      return this.projectId as string;
    }

    // If we've already discovered it, return it
    if (this.projectId) {
      return this.projectId as string;
    }

    // Lookup for the project id from the env variable
    const envPath = path.join(os.homedir(), ".gemini", ".env");

    try {
      const envData = await fs.readFile(envPath, "utf-8");
      const envConfig = dotenv.parse(envData);

      if (envConfig.GOOGLE_CLOUD_PROJECT) {
        this.projectId = envConfig.GOOGLE_CLOUD_PROJECT;
        return this.projectId as string;
      }
    } catch (error) {
      // .env file not found or invalid, continue with default
    }

    const initialProjectId = process.env.GOOGLE_CLOUD_PROJECT ?? "default";

    // Prepare client metadata
    const clientMetadata = {
      ideType: "IDE_UNSPECIFIED",
      platform: "PLATFORM_UNSPECIFIED",
      pluginType: "GEMINI",
      duetProject: initialProjectId,
    };

    try {
      // Call loadCodeAssist to discover the actual project ID
      const loadRequest = {
        cloudaicompanionProject: initialProjectId,
        metadata: clientMetadata,
      };

      const loadResponse = await this.callEndpoint(
        "loadCodeAssist",
        loadRequest,
      );

      // Check if we already have a project ID from the response
      if (loadResponse.cloudaicompanionProject) {
        this.projectId = loadResponse.cloudaicompanionProject;
        return this.projectId as string;
      }

      // If no existing project, we need to onboard
      const defaultTier = loadResponse.allowedTiers?.find(
        (tier: any) => tier.isDefault,
      );
      const tierId = defaultTier?.id || "free-tier";

      const onboardRequest = {
        tierId: tierId,
        cloudaicompanionProject: initialProjectId,
        metadata: clientMetadata,
      };

      let lroResponse = await this.callEndpoint("onboardUser", onboardRequest);

      // Poll until operation is complete with timeout protection
      const MAX_RETRIES = 30; // Maximum number of retries (60 seconds total)
      let retryCount = 0;

      while (!lroResponse.done && retryCount < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        lroResponse = await this.callEndpoint("onboardUser", onboardRequest);
        retryCount++;
      }

      if (!lroResponse.done) {
        throw new Error("Onboarding timeout");
      }

      const discoveredProjectId =
        lroResponse.response?.cloudaicompanionProject?.id || initialProjectId;
      this.projectId = discoveredProjectId;
      return this.projectId as string;
    } catch (error: any) {
      throw new Error(
        `Failed to discover project ID: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parse Server-Sent Events from a stream
   */
  private async *parseSSEStream(
    stream: NodeJS.ReadableStream,
  ): AsyncGenerator<any> {
    let buffer = "";

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            yield parsed;
          } catch (e) {
            console.error("Error parsing SSE data:", e);
          }
        }
      }
    }
  }

  async sendMessage(prompt: string): Promise<AIResponse> {
    try {
      await this.ensureAuthenticated();
      const projectId = await this.discoverProjectId();

      const requestBody = {
        model: this.getDefaultModel(),
        project: projectId,
        request: {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: this.config.temperature ?? 0.7,
            maxOutputTokens: this.config.maxTokens ?? 8192,
          },
        },
      };

      // Call Code Assist streaming endpoint using OAuth2Client
      const response = await this.authClient.request({
        url: `${CODE_ASSIST_ENDPOINT}/${CODE_ASSIST_API_VERSION}:streamGenerateContent`,
        method: "POST",
        params: { alt: "sse" },
        headers: {
          "Content-Type": "application/json",
        },
        responseType: "stream",
        data: JSON.stringify(requestBody),
      });

      // Process the SSE stream and collect the response
      let fullResponse = "";
      let lastUsageMetadata: any = undefined;

      for await (const jsonData of this.parseSSEStream(
        response.data as NodeJS.ReadableStream,
      )) {
        // Extract content from the response
        const responseData = jsonData.response || jsonData;
        const candidate = responseData.candidates?.[0];

        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if (part.text && !part.thought) {
              fullResponse += part.text;
            }
          }
        }

        // Store usage metadata for final reporting
        if (responseData.usageMetadata) {
          lastUsageMetadata = responseData.usageMetadata;
        }

        // Check if this is the final chunk
        if (candidate?.finishReason) {
          break;
        }
      }

      // Extract usage information
      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;

      if (lastUsageMetadata) {
        promptTokens = lastUsageMetadata.promptTokenCount ?? 0;
        completionTokens = lastUsageMetadata.candidatesTokenCount ?? 0;
        totalTokens = promptTokens + completionTokens;
      }

      return {
        content: fullResponse,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
        },
      };
    } catch (error) {
      throw new Error(
        `Gemini CLI API error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  validateConfig(): boolean {
    // Support gemini CLI oauth creds path; default to ~/.gemini/oauth_creds.json when not provided.
    if (!(this.config as any).geminiCliOAuthPath) {
      (this.config as any).geminiCliOAuthPath = "~/.gemini/oauth_creds.json";
    }

    // geminiCliProjectId is optional and can be discovered dynamically

    return true;
  }
}
