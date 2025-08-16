export interface HookTemplate {
  id: string;
  name: string;
  description: string;
  naturalLanguagePatterns: string[];
  codeTemplate: string;
  fileExtensions: string[];
  triggerType: string;
}

export const HOOK_TEMPLATES: HookTemplate[] = [
  {
    id: "kotlin-kdoc",
    name: "Kotlin KDoc Generator",
    description: "Adds KDoc comments to Kotlin functions",
    naturalLanguagePatterns: [
      "kotlin.*kdoc",
      "kotlin.*comment",
      "kotlin.*documentation",
      ".*kotlin.*doc",
    ],
    fileExtensions: [".kt"],
    triggerType: "onDidSaveTextDocument",
    codeTemplate: `
Analyze the following Kotlin code and add KDoc comments to all public functions, classes, and properties.

Rules:
- Use /** */ for KDoc comments
- Describe the purpose of the function
- Document all parameters with @param
- Document the return value with @return if applicable
- Add @throws for exceptions if relevant
- Keep the existing code style

Code:
\`\`\`kotlin
{{fileContent}}
\`\`\`

Return only the complete modified code, without additional explanations.`,
  },
  {
    id: "javascript-jsdoc",
    name: "JavaScript JSDoc Generator",
    description: "Adds JSDoc comments to JavaScript functions",
    naturalLanguagePatterns: [
      "javascript.*jsdoc",
      "javascript.*comment",
      "javascript.*documentation",
      ".*javascript.*doc",
    ],
    fileExtensions: [".js", ".jsx"],
    triggerType: "onDidSaveTextDocument",
    codeTemplate: `
Analyze the following JavaScript code and add JSDoc comments to all functions.

Rules:
- Use /** */ for JSDoc comments
- Describe the purpose of the function
- Document all parameters with @param {type} name - description
- Document the return value with @returns {type} description
- Add @throws for exceptions if relevant
- Keep the existing code style

Code:
\`\`\`javascript
{{fileContent}}
\`\`\`

Return only the complete modified code, without additional explanations.`,
  },
  {
    id: "python-docstrings",
    name: "Python Docstring Generator",
    description: "Adds docstrings to Python functions",
    naturalLanguagePatterns: [
      "python.*docstring",
      "python.*comment",
      "python.*documentation",
      ".*python.*doc",
    ],
    fileExtensions: [".py"],
    triggerType: "onDidSaveTextDocument",
    codeTemplate: `
Analyze the following Python code and add docstrings to all functions and classes.

Rules:
- Use triple quotes for docstrings
- Follow the Google docstring style
- Describe the purpose of the function/class
- Document all parameters in the Args: section
- Document the return value in the Returns: section
- Add Raises: section for exceptions if relevant
- Keep the existing code style

Code:
\`\`\`python
{{fileContent}}
\`\`\`

Return only the complete modified code, without additional explanations.`,
  },
  {
    id: "code-review",
    name: "Code Review Assistant",
    description: "Reviews code quality and provides improvement suggestions",
    naturalLanguagePatterns: [
      ".*code.*review",
      ".*quality.*check",
      ".*review.*code",
      ".*check.*code",
    ],
    fileExtensions: [".*"],
    triggerType: "onDidSaveTextDocument",
    codeTemplate: `
Perform a code review for the following code and provide improvement suggestions.

Check for:
- Code style and formatting
- Potential bugs or issues
- Performance optimizations
- Best practices
- Security issues
- Readability and maintainability

Code ({{language}}):
\`\`\`{{language}}
{{fileContent}}
\`\`\`

Return a structured analysis with concrete improvement suggestions, but do NOT modify the code.`,
  },
  {
    id: "typescript-types",
    name: "TypeScript Type Generator",
    description: "Adds TypeScript type annotations",
    naturalLanguagePatterns: [
      "typescript.*type",
      "typescript.*annotation",
      ".*typescript.*type",
      ".*typ.*typescript",
    ],
    fileExtensions: [".ts", ".tsx"],
    triggerType: "onDidSaveTextDocument",
    codeTemplate: `
Analyze the following TypeScript code and add missing type annotations.

Rules:
- Add explicit types for function parameters
- Define return types for functions
- Create interfaces for objects when appropriate
- Use union types where applicable
- Keep the existing code style
- Use strict TypeScript typing

Code:
\`\`\`typescript
{{fileContent}}
\`\`\`

Return only the complete modified code, without additional explanations.`,
  },
];

export class TemplateEngine {
  public static findMatchingTemplate(
    naturalLanguage: string,
    fileExtension: string
  ): HookTemplate | null {
    const lowerNL = naturalLanguage.toLowerCase();

    for (const template of HOOK_TEMPLATES) {
      // Check if file extension matches
      const extensionMatches =
        template.fileExtensions.includes(fileExtension) ||
        template.fileExtensions.includes(".*");

      if (!extensionMatches) continue;

      // Check if natural language patterns match
      const patternMatches = template.naturalLanguagePatterns.some(
        (pattern) => {
          const regex = new RegExp(pattern, "i");
          return regex.test(lowerNL);
        }
      );

      if (patternMatches) {
        return template;
      }
    }

    return null;
  }

  public static generatePrompt(template: HookTemplate, context: any): string {
    let prompt = template.codeTemplate;

    // Replace placeholders
    prompt = prompt.replace(/\{\{fileContent\}\}/g, context.content || "");
    prompt = prompt.replace(/\{\{language\}\}/g, context.language || "");
    prompt = prompt.replace(/\{\{fileName\}\}/g, context.file || "");

    return prompt;
  }

  public static getTemplateById(id: string): HookTemplate | null {
    return HOOK_TEMPLATES.find((t) => t.id === id) || null;
  }

  public static getAllTemplates(): HookTemplate[] {
    return HOOK_TEMPLATES;
  }
}
