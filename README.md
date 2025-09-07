# 🔗 HookFlow - AI Agent Hooks

![Visual Studio Marketplace Downloads](https://badgen.net/vs-marketplace/d/sockethunter.ai-agent-hooks)
![Visual Studio Marketplace Version](https://badgen.net/vs-marketplace/v/sockethunter.ai-agent-hooks)
![Visual Studio Marketplace Rating](https://badgen.net/vs-marketplace/rating/sockethunter.ai-agent-hooks)

[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=sockethunter.ai-agent-hooks)

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

- **Visual Hook Manager**: Easy-to-use WebView interface with MCP configuration
- **Real-time Status**: See when hooks are running with MCP execution details
- **Live Editing**: Modify hooks and MCP settings on-the-fly
- **Pattern Matching**: Target specific file types with glob patterns
- **Stop Control**: Cancel running hooks anytime
- **MCP Tool Selection**: Visual interface for enabling project-specific tools
- **⚡ Execution Control**: Configure hook execution behavior (single, multiple, restart)
- **📊 Priority System**: Control execution order when multiple hooks match the same file

### 🛡️ Smart Safety Features

- **Anti-Recursion**: Prevents hooks from triggering themselves
- **Cooldown System**: Configurable delays between executions
- **Cross-Hook Protection**: Prevents hooks from triggering each other
- **File Pattern Filtering**: Precise control over which files trigger hooks
- **🔒 Execution Modes**: Single, multiple, or restart execution to prevent conflicts
- **📋 Sequential Processing**: Multiple hooks on same file execute in priority order

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
   - Run `HookFlow - AI Agent Hooks: Choose AI Provider`
   - Choose your preferred AI provider and enter credentials

3. **Configure MCP Tools (Optional)**

   - Open Command Palette (`Ctrl+Shift+P`)
   - Run `HookFlow - AI Agent Hooks: Configure MCP Tools`
   - Select tools based on your project (Git tools, file operations, etc.)
   - This enables advanced multi-step reasoning for hooks

4. **Create Your First Hook**

   - Open Command Palette (`Ctrl+Shift+P`)
   - Run `HookFlow - AI Agent Hooks: Open Hook Manager`
   - Click "🚀 Create Hook"
   - Fill in natural language description
   - Select trigger event and file pattern
   - **Configure execution behavior:**
     - Choose execution mode: Single (default), Multiple, or Restart
     - Set priority (0-100) for ordering when multiple hooks match
   - **Enable MCP for advanced reasoning:**
     - Check "Enable MCP" for multi-step execution
     - Select project-specific tools (recommended tools pre-selected)
     - Enable multi-step execution for complex workflows

5. **Watch the Magic Happen**
   - Your hooks will automatically execute when conditions are met
   - Monitor status in real-time through the Hook Manager

## 📋 Example Use Cases

### 📝 Documentation Automation

```
Name: Kotlin KDoc Generator
Description: "Whenever I change a Kotlin file, add KDoc comments to all functions"
Trigger: File saved
Pattern: **/*.kt
MCP: ✅ Enabled with mcp_filesystem_read, mcp_search_find
Multi-Step: ✅ Analyzes existing code patterns before adding docs
```

### 🧪 Test Generation

```
Name: JavaScript Test Creator
Description: "When I create a new JS file, generate corresponding Jest test file"
Trigger: File created
Pattern: **/*.js
MCP: ✅ Enabled with mcp_filesystem_list, mcp_search_grep
Multi-Step: ✅ Finds existing test patterns and follows project conventions
```

### 🎨 Code Formatting

```
Name: Python Style Checker
Description: "On every Python save, check code quality and add docstrings"
Trigger: File saved
Pattern: **/*.py
MCP: ✅ Enabled with mcp_search_grep, mcp_git_status
Multi-Step: ✅ Checks git status and analyzes project style before modifications
```

### 📖 README Maintenance

```
Name: Project Documentation
Description: "When I create any file, update the README.md with project structure"
Trigger: File created
Pattern: **/*
MCP: ✅ Enabled with mcp_filesystem_list, mcp_filesystem_read_multiple
Multi-Step: ✅ Analyzes entire project structure and existing README before updates
```

## ⚡ Hook Execution Modes

Control how your hooks behave when triggered multiple times or when multiple hooks target the same file:

### 🔒 Single Mode (Default)

- **Behavior**: Only one execution at a time per hook
- **Use Case**: Resource-intensive operations, file modifications that require exclusive access
- **Example**: Large file refactoring, database operations

### 🔄 Multiple Mode

- **Behavior**: Allow multiple parallel executions of the same hook
- **Use Case**: Independent operations, logging, notifications
- **Example**: Code formatting, syntax checking, file analysis

### 🔁 Restart Mode

- **Behavior**: Stop current execution and restart with new trigger
- **Use Case**: Frequently changing files, real-time processing
- **Example**: Live documentation updates, incremental compilation

### 📊 Priority System

When multiple hooks target the same file, they execute sequentially by priority:

```
Priority 10: High-priority hook (documentation)
Priority 5:  Medium-priority hook (formatting)
Priority 1:  Low-priority hook (logging)
```

**Example Configuration:**

```
Hook A: "Format code" - Priority: 10, Mode: Single
Hook B: "Add logging" - Priority: 5, Mode: Multiple
Hook C: "Update docs" - Priority: 1, Mode: Restart
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

### MCP (Model Context Protocol) Configuration

```json
{
  "aiAgentHooks.mcp.enabled": true,
  "aiAgentHooks.mcp.defaultTools": [
    "mcp_filesystem_list",
    "mcp_filesystem_read",
    "mcp_search_find",
    "mcp_git_status"
  ],
  "aiAgentHooks.mcp.allowedTools": [
    "mcp_filesystem_list",
    "mcp_filesystem_read",
    "mcp_filesystem_read_multiple",
    "mcp_search_find",
    "mcp_search_grep",
    "mcp_git_status",
    "mcp_git_log"
  ]
}
```

## 🎮 Commands

| Command                               | Description                          |
| ------------------------------------- | ------------------------------------ |
| `AI Agent Hooks: Choose AI Provider`  | Select and configure AI provider     |
| `AI Agent Hooks: Test AI Provider`    | Test current AI provider connection  |
| `AI Agent Hooks: Open Hook Manager`   | Open visual Hook Manager interface   |
| `AI Agent Hooks: Configure MCP Tools` | Configure MCP tools for this project |
| `AI Agent Hooks: Open Vibe Mode` ⭐   | Open AI chat interface with MCP      |

### Status Bar Quick Actions

Click the **HookFlow** status bar item for quick access to:

- 🛠️ Manage Hooks
- ⚙️ Configure AI Provider
- 🧪 Test AI Provider
- 📋 Hook Status Overview
- 🔧 Configure MCP Tools

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

```bash
npm test                    # Run all tests
npm run test:coverage       # Run tests with coverage report
npm run compile            # Compile TypeScript
npm run lint              # Check code style
```

## 🔒 Security & Safety

### Built-in Protection

- **Local Storage**: Hooks stored locally in VSCode settings
- **Execution Limits**: Cooldown prevents runaway executions

### Best Practices

- Start with simple, specific hooks
- Use narrow file patterns (`**/*.js` vs `**/*`)
- Test hooks on small projects first
- Regular backup of important code

## 🐛 Known Issues

### Standard Hooks (Non-MCP) Limitations

Standard hooks without MCP enabled implement simple prompt-response patterns. This results in several limitations:

Context Awareness

- Limited Scope: Hooks only analyze the single triggered file, missing broader project context
- No Project Understanding: Cannot analyze folder structures, related files, or project dependencies
- Static Processing: No dynamic exploration of codebase or adaptive reasoning based on discoveries

Missing Agent Capabilities

- No Multi-Step Planning: Cannot break down complex tasks into logical sub-steps
- No File System Exploration: Cannot list directory contents or explore project structure
- No Multi-File Reading: Cannot read multiple related files to understand context
- No Command Execution: Cannot run read-only commands (ls, find, grep, git status) to gather information
- No Configurable Tool Access: Missing whitelist system for allowing specific safe commands
- No Cross-File Analysis: Cannot read related files (tests, configs, documentation) to inform decisions
- No Iterative Refinement: Cannot analyze results and adjust approach based on intermediate outcomes

Examples of Current Limitations

Current: Simple transformation\
"Add JSDoc to this function" → Modifies single file

Missing: Complex agent workflow\
 "Refactor this component following project patterns" →

1. List project files to understand structure (ls, find)
2. Read similar components for pattern analysis
3. Execute git status to check for uncommitted changes
4. Extract common patterns from multiple files
5. Apply consistent architecture with context awareness
6. Update related tests and documentation files

Impact on Use Cases

- Architecture Decisions: Cannot analyze project patterns for consistent refactoring
- Smart Test Generation: Cannot understand existing test patterns and file relationships
- Documentation Sync: Cannot cross-reference multiple files for comprehensive docs
- Code Migration: Cannot analyze dependencies and impact across multiple files

## 🔧 Potential Solution: MCP Integration

The limitations above could be addressed through **Model Context Protocol (MCP)** integration, which would enable sophisticated AI agent workflows:

### Proposed MCP Architecture

```
Hook Trigger → MCP Client → AI Model with Tools → Multi-Step Execution → File Modifications
```

### MCP-Enabled Capabilities

**File System Tools**

- `mcp_filesystem`: List directories, explore project structure
- `mcp_search`: Advanced file searching with grep, ripgrep
- `mcp_git`: Git operations (status, log, diff) for context

**Multi-File Operations**

- Read multiple related files simultaneously
- Cross-reference imports, exports, and dependencies
- Analyze test patterns across the codebase

**Configurable Tool Access**

- Whitelist system for allowed MCP tools
- Security boundaries for safe command execution
- User-controlled permission levels per hook

**Agent Workflow Example**

```
"Refactor component following project patterns" →
1. mcp_filesystem.list() - Explore project structure
2. mcp_search.find() - Locate similar components
3. mcp_filesystem.read_multiple() - Analyze patterns
4. mcp_git.status() - Check for conflicts
5. Multi-step reasoning and planning
6. Coordinated file modifications
```

### Implementation Benefits

- **Context-Aware**: Full project understanding before modifications
- **Safe Execution**: MCP security model prevents dangerous operations
- **Extensible**: Plugin architecture for custom tools
- **Configurable**: User controls which tools each hook can access

**✅ IMPLEMENTED:** The above MCP integration is now available! Enable MCP in the Hook Manager UI to unlock advanced reasoning capabilities.

### Current Status: MCP Available

The Hook Manager now includes:

- ✅ **Visual MCP Configuration** in the UI
- ✅ **Project-Specific Tool Detection** (Git tools for Git repos, etc.)
- ✅ **Multi-Step Execution** with context awareness
- ✅ **Tool Whitelisting** per hook
- ✅ **Real-Time Status** showing MCP vs Standard execution

Simply check "Enable MCP" when creating hooks to access sophisticated AI agent workflows!

## 📈 Roadmap

- 🔮 **v0.1.0**: MCP Integration ✅ IMPLEMENTED
  - ✅ MCP Client with filesystem, search, and git tools
  - ✅ Multi-step execution with AI planning
  - ✅ Configurable tool whitelisting per hook
  - ✅ Advanced reasoning capabilities with context awareness
  - ✅ Visual MCP configuration in Hook Manager WebView
  - ✅ Project-specific tool recommendations
  - ✅ Real-time MCP status indicators
- 🚀 **v0.2.0**: Advanced Execution Control ✅ IMPLEMENTED
  - ✅ Hook execution modes (single, multiple, restart)
  - ✅ Priority-based sequential execution system
  - ✅ Queue management for multiple hooks on same file
  - ✅ Enhanced execution control and safety features
  - ✅ Comprehensive test coverage (96 tests, 100% coverage)
- 🎨 **v0.3.0**: Enhanced Analytics & Debugging ✅ IMPLEMENTED
  - ✅ **Vibe Mode**: AI-powered chat interface with MCP integration
  - ✅ **Status Bar Integration**: Real-time hook status display and quick access
  - ✅ **Enhanced Command System**: Quick access palette via status bar
  - ✅ **File-Level Locking**: Race condition prevention for multiple hooks
  - ✅ **Iterative AI Thinking**: Multi-step tool planning and execution
  - ✅ **MCP Tool Configuration UI**: Direct tool activation in chat interface
  - ✅ **Error Transparency**: Visible tool failures and debugging info
- 🌟 **v0.4.0**: Advanced Features
  - 🔌 Custom MCP tool plugins
  - 🤝 Team hook sharing and templates
  - 🔄 Hook execution pipelines

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
