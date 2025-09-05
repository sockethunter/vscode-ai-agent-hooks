# Change Log

All notable changes to the "ai-agent-hooks" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.3.1] - 2025-09-06

### Fixed

- vibe mode button missing in status bar menu

## [0.3.0] - 2025-09-06

### Added

- **Status Bar Integration**: Real-time hook status display in VSCode status bar
  - Shows running hook count with dynamic icons
  - Clickable status bar item opens command palette
  - Color-coded status indicators (running, active, inactive)
- **Vibe Mode Chat Window**: AI-powered conversational interface
  - Integrated in Explorer sidebar with dedicated panel
  - MCP-enhanced conversations for project analysis
  - Real-time hook visualization and control
  - Project-aware chat context using MCP tools
- **Enhanced Command System**:
  - Quick access command palette via status bar
  - Hook status overview with detailed information
  - Streamlined provider and MCP configuration
- **Improved Hook Activity Monitoring**:
  - Real-time status updates across all interfaces
  - Visual indicators for hook execution states
  - Enhanced error reporting and debugging

### Technical

- Added `StatusBarProvider` for status bar integration
- Added `VibeProvider` for chat interface with MCP support
- Enhanced `HookManager` with status change events
- Improved provider system with response generation
- Updated extension activation with new providers
- Implemented file-level locking system to prevent race conditions
- Added iterative AI thinking with multi-step tool execution
- Centralized MCP tool descriptions (DRY principle)
- Enhanced error visibility and debugging capabilities

## [0.2.0] - 2025-08-18

### Added

- **Hook Execution Modes**: Configure how hooks behave when triggered multiple times
  - `single`: Only one execution at a time per hook (default)
  - `multiple`: Allow multiple parallel executions
  - `restart`: Stop current execution and restart with new trigger
- **Priority System**: Control execution order when multiple hooks match the same file
  - Priority values from 0-100 (higher numbers = higher priority)
  - Hooks execute sequentially in priority order
- **Sequential Execution Queue**: Automatic queuing system for multiple hooks on same file
- **Enhanced Hook Manager UI**:
  - Visual execution mode selection
  - Priority configuration slider
  - Execution status indicators

## [0.1.1] - 2025-08-17

### Fixed

- ui not correctly being packaged

### Updated

- package categories (Other -> AI, Machine Learning)

## [0.1.0] - 2025-08-16

### Added

- advanced multi-step reasoning
- mcp tools

## [0.0.1] - 2025-08-15

- Initial release
