# 🔗 AI Agent Hooks

**Automated event-driven AI agent hooks for Visual Studio Code**

Transform your development workflow with intelligent automation! AI Agent Hooks allows you to create smart hooks that automatically trigger AI-powered code modifications based on file events using natural language descriptions.

## ✨ Features

### 🤖 Natural Language Hook Creation

- Describe what you want in plain language
- Example: _"Whenever I modify a Kotlin file, add KDoc comments to all functions"_
- AI automatically generates the appropriate code modifications

### 🎯 Event-Driven Automation

- **File Save**: Trigger when files are saved
- **File Change**: React to file modifications
- **File Open**: Execute when files are opened
- **File Create**: Respond to new file creation
- **File Delete**: Handle file deletion events

### 🔧 Advanced Hook Management

- **Visual Hook Manager**: Easy-to-use WebView interface
- **Real-time Status**: See when hooks are running
- **Live Editing**: Modify hooks on-the-fly
- **Pattern Matching**: Target specific file types with glob patterns
- **Stop Control**: Cancel running hooks anytime

### 🛡️ Smart Safety Features

- **Anti-Recursion**: Prevents hooks from triggering themselves
- **Cooldown System**: Configurable delays between executions
- **Cross-Hook Protection**: Prevents hooks from triggering each other
- **File Pattern Filtering**: Precise control over which files trigger hooks

### 🌐 Multiple AI Provider Support

- **OpenAI** (GPT-4, GPT-3.5)
- **Anthropic** (Claude 3 Sonnet, Haiku)
- **Ollama** (Local LLMs)
- **Azure OpenAI**

## 🚀 Quick Start

1. **Install the Extension**

   ```bash
   # Install from VSCode Marketplace or load as development extension
   ```

2. **Configure AI Provider**

   - Open Command Palette (`Ctrl+Shift+P`)
   - Run `AI Agent Hooks: AI Provider auswählen`
   - Choose your preferred AI provider and enter credentials

3. **Create Your First Hook**

   - Open Command Palette (`Ctrl+Shift+P`)
   - Run `AI Agent Hooks: Hook Manager öffnen`
   - Click "🚀 Create Hook"
   - Fill in natural language description
   - Select trigger event and file pattern

4. **Watch the Magic Happen**
   - Your hooks will automatically execute when conditions are met
   - Monitor status in real-time through the Hook Manager

## 📋 Example Use Cases

### 📝 Documentation Automation

```
Name: Kotlin KDoc Generator
Description: "Whenever I change a Kotlin file, add KDoc comments to all functions"
Trigger: File saved
Pattern: **/*.kt
```

### 🧪 Test Generation

```
Name: JavaScript Test Creator
Description: "When I create a new JS file, generate corresponding Jest test file"
Trigger: File created
Pattern: **/*.js
```

### 🎨 Code Formatting

```
Name: Python Style Checker
Description: "On every Python save, check code quality and add docstrings"
Trigger: File saved
Pattern: **/*.py
```

### 📖 README Maintenance

```
Name: Project Documentation
Description: "When I create any file, update the README.md with project structure"
Trigger: File created
Pattern: **/*
```

## 📚 Extension Settings

Configure AI Agent Hooks through VSCode settings:

### AI Provider Configuration

```json
{
  "aiAgentHooks.provider": "openai",
  "aiAgentHooks.openai.apiKey": "your-api-key",
  "aiAgentHooks.openai.model": "gpt-4",
  "aiAgentHooks.anthropic.apiKey": "your-claude-key",
  "aiAgentHooks.anthropic.model": "claude-3-sonnet-20240229",
  "aiAgentHooks.ollama.baseUrl": "http://localhost:11434",
  "aiAgentHooks.ollama.model": "llama2",
  "aiAgentHooks.azureOpenai.apiKey": "your-azure-key",
  "aiAgentHooks.azureOpenai.baseUrl": "https://your-resource.openai.azure.com",
  "aiAgentHooks.azureOpenai.model": "your-deployment-name"
}
```

## 🎮 Commands

| Command                              | Description                         |
| ------------------------------------ | ----------------------------------- |
| `AI Agent Hooks: Choose AI Provider` | Select and configure AI provider    |
| `AI Agent Hooks: Test AI Provider`   | Test current AI provider connection |
| `AI Agent Hooks: Open Hook Manager`  | Open visual Hook Manager interface  |

## 🏗️ Architecture

### Core Components

- **HookManager**: Central hook lifecycle management
- **HookExecutor**: Event listening and hook execution
- **ProviderManager**: AI provider abstraction layer
- **WebView Provider**: Visual interface for hook management
- **FileUtils**: Cross-platform file operations

### Hook Lifecycle

1. **Registration**: Active hooks register event listeners
2. **Triggering**: File events trigger pattern matching
3. **Execution**: AI provider processes natural language
4. **Application**: Code changes applied to target files
5. **Completion**: Status updates sent to WebView

## 🧪 Testing

Comprehensive test suite with **63 passing tests**:

```bash
npm test                    # Run all tests
npm run compile            # Compile TypeScript
npm run lint              # Check code style
```

### Test Coverage

- ✅ Hook Management (CRUD operations, persistence)
- ✅ Hook Execution (triggers, patterns, cooldowns)
- ✅ AI Provider Integration (all provider types)
- ✅ WebView Communication (real-time updates)
- ✅ File Operations (cross-platform compatibility)

## 🔒 Security & Safety

### Built-in Protection

- **No Secret Logging**: API keys never appear in logs
- **Local Storage**: Hooks stored locally in VSCode settings
- **Permission Control**: Only modifies files based on explicit patterns
- **Execution Limits**: Cooldown prevents runaway executions

### Best Practices

- Start with simple, specific hooks
- Use narrow file patterns (`**/*.js` vs `**/*`)
- Test hooks on small projects first
- Regular backup of important code

## 🐛 Known Issues

The current hook system implements simple prompt-response patterns rather than sophisticated AI agent workflows. This results in several limitations:

Context Awareness

- Limited Scope: Hooks only analyze the single triggered file, missing broader project context
- No Project Understanding: Cannot analyze folder structures, related files, or project dependencies
- Static Processing: No dynamic exploration of codebase or adaptive reasoning based on discoveries

Missing Agent Capabilities

- No Multi-Step Planning: Cannot break down complex tasks into logical sub-steps
- No Tool Integration: Cannot use workspace tools like ls, find, grep for context gathering
- No Cross-File Analysis: Cannot read related files (tests, configs, documentation) to inform decisions
- No Iterative Refinement: Cannot analyze results and adjust approach based on intermediate outcomes

Examples of Current Limitations

Current: Simple transformation\
"Add JSDoc to this function" → Modifies single file

Missing: Complex agent workflow\
 "Refactor this component following project patterns" →
  1. Analyze project structure 
  2. Find similar components 
  3. Extract common patterns 
  4. Apply consistent architecture 
  5. Update related tests and docs

Impact on Use Cases

- Architecture Decisions: Cannot analyze project patterns for consistent refactoring
- Smart Test Generation: Cannot understand existing test patterns and file relationships
- Documentation Sync: Cannot cross-reference multiple files for comprehensive docs
- Code Migration: Cannot analyze dependencies and impact across multiple files

## 📈 Roadmap

- 🔮 **v1.1.0**: TBD

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

## 📄 License

This project is licensed under the **GNU General Public License v3.0 (GPLv3)**.  
See the [LICENSE](./LICENSE) file for full license details.

© 2025 sockethunter. All rights reserved.

**Note:** If you modify or redistribute this project, the source code must remain under GPLv3, and my name as the original author must be retained.

## 💖 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/sockethunter/vscode-ai-agent-hooks/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/sockethunter/vscode-ai-agent-hooks/discussions)
- 📧 **Email**: mert246@proton.me
