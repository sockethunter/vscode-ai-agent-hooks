# Change Log

All notable changes to the "ai-agent-hooks" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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
