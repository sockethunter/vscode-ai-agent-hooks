import * as vscode from 'vscode';
import { Hook } from '../hookManager';
import { McpClient, McpExecutionContext } from './mcpClient';
import { ProviderManager } from '../providers/providerManager';

export interface ExecutionStep {
  id: string;
  type: 'mcp_tool' | 'ai_reasoning' | 'file_modification';
  description: string;
  toolName?: string;
  parameters?: any;
  result?: any;
  error?: string;
  completed: boolean;
}

export interface ExecutionPlan {
  hookId: string;
  steps: ExecutionStep[];
  context: McpExecutionContext;
  currentStepIndex: number;
  completed: boolean;
}

export class MultiStepExecutor {
  private static instance: MultiStepExecutor;
  private mcpClient: McpClient;
  private providerManager: ProviderManager;
  private activePlans: Map<string, ExecutionPlan> = new Map();

  private constructor() {
    this.mcpClient = McpClient.getInstance();
    this.providerManager = ProviderManager.getInstance();
  }

  public static getInstance(): MultiStepExecutor {
    if (!MultiStepExecutor.instance) {
      MultiStepExecutor.instance = new MultiStepExecutor();
    }
    return MultiStepExecutor.instance;
  }

  public async executeHookWithMcp(
    hook: Hook, 
    triggeredFile: string, 
    workspaceRoot: string
  ): Promise<void> {
    if (!hook.mcpEnabled || !hook.multiStepEnabled) {
      throw new Error('Hook is not configured for MCP multi-step execution');
    }

    const executionId = this.generateExecutionId();
    const context: McpExecutionContext = {
      workspaceRoot,
      triggeredFile,
      hookId: hook.id,
      allowedTools: hook.allowedMcpTools || []
    };

    console.log(`🚀 Starting multi-step execution for hook: ${hook.name}`);

    try {
      // Step 1: Generate execution plan using AI
      const plan = await this.generateExecutionPlan(hook, context);
      this.activePlans.set(executionId, plan);

      // Step 2: Execute each step in the plan
      await this.executePlan(plan);

      console.log(`✅ Multi-step execution completed for hook: ${hook.name}`);
    } catch (error) {
      console.error(`❌ Multi-step execution failed for hook: ${hook.name}`, error);
      throw error;
    } finally {
      this.activePlans.delete(executionId);
    }
  }

  private async generateExecutionPlan(
    hook: Hook, 
    context: McpExecutionContext
  ): Promise<ExecutionPlan> {
    const planningPrompt = this.createPlanningPrompt(hook, context);
    
    try {
      const provider = this.providerManager.getCurrentProvider();
      if (!provider) {
        throw new Error("No AI provider configured");
      }
      const response = await provider.sendMessage(planningPrompt);
      const steps = this.parseExecutionSteps(response.content, hook.allowedMcpTools || []);

      return {
        hookId: hook.id,
        steps,
        context,
        currentStepIndex: 0,
        completed: false
      };
    } catch (error) {
      console.error('Failed to generate execution plan:', error);
      throw new Error('Could not generate execution plan');
    }
  }

  private createPlanningPrompt(hook: Hook, context: McpExecutionContext): string {
    const availableTools = this.mcpClient.getAvailableTools()
      .filter(tool => context.allowedTools.includes(tool));

    const toolDescriptions: Record<string, string> = {
      'mcp_filesystem_list': 'List directory contents',
      'mcp_filesystem_read': 'Read single file contents', 
      'mcp_filesystem_read_multiple': 'Read multiple files at once',
      'mcp_search_find': 'Find files by glob pattern',
      'mcp_search_grep': 'Search text patterns in files',
      'mcp_git_status': 'Get git repository status',
      'mcp_git_log': 'Get git commit history'
    };

    return `You are an AI agent planning a multi-step code modification task.

TASK: ${hook.naturalLanguage}
TRIGGERED FILE: ${context.triggeredFile}
WORKSPACE: ${context.workspaceRoot}

AVAILABLE TOOLS:
${availableTools.map(tool => `- ${tool}: ${toolDescriptions[tool] || 'Available tool'}`).join('\n')}

IMPORTANT: You MUST respond with ONLY valid JSON in the exact format below. Do not include any explanations, markdown, or other text.

STEP TYPES (use exactly these):
- "mcp_tool" - for using MCP tools (must include toolName and parameters)
- "ai_reasoning" - for analysis steps  
- "file_modification" - for applying changes

OUTPUT TEMPLATE (copy this structure exactly):
{
  "steps": [
    {
      "type": "mcp_tool",
      "description": "Find all JavaScript files in the project",
      "toolName": "mcp_search_find", 
      "parameters": {"pattern": "**/*.js", "directory": "."}
    },
    {
      "type": "mcp_tool",
      "description": "Read the found files to check existing content",
      "toolName": "mcp_filesystem_read_multiple",
      "parameters": {"paths": []}
    },
    {
      "type": "ai_reasoning",
      "description": "Analyze which files need the copyright notice"
    },
    {
      "type": "file_modification", 
      "description": "Add copyright notice to files that don't have it"
    }
  ]
}

Replace the example steps above with your actual plan for the task: "${hook.naturalLanguage}"

RESPOND WITH ONLY THE JSON OBJECT:`;
  }

  private parseExecutionSteps(response: string, allowedTools: string[]): ExecutionStep[] {
    console.log('🔍 Parsing AI response for execution steps...');
    console.log('Raw response:', response.substring(0, 200) + '...');
    
    try {
      // Clean the response - remove any markdown formatting
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks if present
      cleanResponse = cleanResponse.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '');
      
      // Extract JSON object from response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.steps || !Array.isArray(parsed.steps)) {
        throw new Error('Invalid response format: missing steps array');
      }

      console.log(`✅ Successfully parsed ${parsed.steps.length} execution steps`);

      return parsed.steps.map((step: any, index: number) => {
        // Validate step structure
        if (!step.type) {
          throw new Error(`Invalid step ${index}: missing type`);
        }
        
        // Auto-correct common AI mistakes
        let stepType = step.type;
        if (stepType.startsWith('mcp_') && stepType !== 'mcp_tool') {
          console.log(`⚠️  Auto-correcting step type from "${stepType}" to "mcp_tool"`);
          stepType = 'mcp_tool';
        }
        
        // Auto-generate description if missing
        let description = step.description;
        if (!description) {
          if (stepType === 'mcp_tool' && step.toolName) {
            description = `Execute ${step.toolName}`;
            console.log(`⚠️  Auto-generated description for step ${index}: "${description}"`);
          } else {
            description = `Step ${index + 1}`;
            console.log(`⚠️  Auto-generated generic description for step ${index}`);
          }
        }
        
        // Validate tool access
        if (stepType === 'mcp_tool') {
          if (!step.toolName) {
            throw new Error(`Invalid mcp_tool step ${index}: missing toolName`);
          }
          if (!allowedTools.includes(step.toolName)) {
            throw new Error(`Tool ${step.toolName} is not allowed for this hook`);
          }
        }

        return {
          id: `step_${index}`,
          type: stepType,
          description,
          toolName: step.toolName,
          parameters: step.parameters || {},
          completed: false
        };
      });
    } catch (error) {
      console.error('❌ Failed to parse execution steps:', error);
      console.error('Response that failed to parse:', response);
      throw new Error(`Could not parse execution plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executePlan(plan: ExecutionPlan): Promise<void> {
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      plan.currentStepIndex = i;

      console.log(`📋 Executing step ${i + 1}/${plan.steps.length}: ${step.description}`);

      try {
        await this.executeStep(step, plan);
        step.completed = true;
        console.log(`✅ Step ${i + 1} completed successfully`);
      } catch (error) {
        step.error = error instanceof Error ? error.message : String(error);
        console.error(`❌ Step ${i + 1} failed:`, error);
        throw error;
      }
    }

    plan.completed = true;
  }

  private async executeStep(step: ExecutionStep, plan: ExecutionPlan): Promise<void> {
    switch (step.type) {
      case 'mcp_tool':
        if (!step.toolName) {
          throw new Error('MCP tool step missing toolName');
        }
        
        // Handle dynamic parameters from previous steps
        let parameters = step.parameters || {};
        if (step.toolName === 'mcp_filesystem_read_multiple' && (!parameters.paths || parameters.paths.length === 0)) {
          // Get file paths from previous search step
          const searchStep = plan.steps.find(s => s.toolName === 'mcp_search_find' && s.completed);
          if (searchStep && searchStep.result && searchStep.result.matches) {
            parameters.paths = searchStep.result.matches;
            console.log(`📄 Using ${parameters.paths.length} files from search step`);
          }
        }
        
        step.result = await this.mcpClient.executeTool(
          step.toolName,
          parameters,
          plan.context
        );
        break;

      case 'ai_reasoning':
        step.result = await this.performAiReasoning(step, plan);
        break;

      case 'file_modification':
        await this.performFileModification(step, plan);
        step.result = 'File modifications applied';
        break;

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async performAiReasoning(step: ExecutionStep, plan: ExecutionPlan): Promise<string> {
    // Gather all previous step results for context
    const previousResults = plan.steps
      .slice(0, plan.currentStepIndex)
      .filter(s => s.completed && s.result)
      .map(s => `${s.description}: ${JSON.stringify(s.result)}`)
      .join('\n\n');

    const reasoningPrompt = `
TASK: ${step.description}

CONTEXT FROM PREVIOUS STEPS:
${previousResults}

CURRENT FILE: ${plan.context.triggeredFile}

Analyze the gathered information and determine:
1. What patterns or issues were found?
2. What changes need to be made?
3. Which files should be modified?
4. What specific modifications should be applied?

Provide a detailed analysis and recommendations.
`;

    try {
      const provider = this.providerManager.getCurrentProvider();
      if (!provider) {
        throw new Error("No AI provider configured");
      }
      const response = await provider.sendMessage(reasoningPrompt);
      return response.content;
    } catch (error) {
      console.error('AI reasoning failed:', error);
      throw new Error('Could not perform AI reasoning step');
    }
  }

  private async performFileModification(step: ExecutionStep, plan: ExecutionPlan): Promise<void> {
    // Get the reasoning from previous steps
    const reasoningSteps = plan.steps
      .filter(s => s.type === 'ai_reasoning' && s.completed && s.result)
      .map(s => s.result)
      .join('\n\n');

    // Read the current file
    const document = await vscode.workspace.openTextDocument(plan.context.triggeredFile);
    const currentContent = document.getText();

    const modificationPrompt = `
TASK: Apply the planned modifications to the triggered file.

REASONING AND ANALYSIS:
${reasoningSteps}

CURRENT FILE CONTENT:
${currentContent}

FILE PATH: ${plan.context.triggeredFile}

Generate the complete modified content for this file. 
Respond with ONLY the complete file content, no explanations or markdown formatting.
`;

    try {
      const provider = this.providerManager.getCurrentProvider();
      if (!provider) {
        throw new Error("No AI provider configured");
      }
      const response = await provider.sendMessage(modificationPrompt);
      const modifiedContent = response.content;
      
      // Apply the modifications
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(currentContent.length)
      );
      edit.replace(document.uri, fullRange, modifiedContent);
      
      await vscode.workspace.applyEdit(edit);
      await document.save();

      console.log(`📝 File modified: ${plan.context.triggeredFile}`);
    } catch (error) {
      console.error('File modification failed:', error);
      throw new Error('Could not apply file modifications');
    }
  }

  public getActivePlans(): ExecutionPlan[] {
    return Array.from(this.activePlans.values());
  }

  public getPlanStatus(executionId: string): ExecutionPlan | undefined {
    return this.activePlans.get(executionId);
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}