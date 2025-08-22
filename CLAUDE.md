# FlowCode Project Guidelines

## Architecture Documentation

When working on code in specific directories, ALWAYS check the README.md file in that directory first to understand the architecture, patterns, and conventions. Each major directory has comprehensive documentation:

- `src/application/agents/README.md` - Agent system architecture and patterns
- `src/application/stores/README.md` - Data persistence and repository patterns  
- `src/application/tools/README.md` - Tool system and permission architecture
- `src/application/services/README.md` - Service layer and business logic
- `src/common/README.md` - Shared utilities and cross-cutting concerns

**When modifying code in these areas, update the corresponding README.md if the architecture or patterns change.**

## Message Handling

### Message ID Behavior

- **Message IDs can be duplicated** - this is expected behavior, not a bug
- When a message ID appears multiple times, the newer message updates/replaces the older one
- This pattern supports **streaming/chunking scenarios**:
  - First message might contain a partial chunk of content
  - Later messages with the same ID contain the complete/appended content
  - This allows for progressive message building and real-time updates

### AsyncControl Message Management

- `queuedMessages`: Appends additional messages to the existing conversation history
- `summarizedMessages`: Replaces the entire conversation history with summarized messages
- Both are handled in BaseWorker for efficient memory management in long conversations

## Testing Guidelines

- When testing message flows, account for potential duplicate message IDs
- Expect that message content may be updated/expanded across iterations
- Test both chunked and complete message scenarios where applicable

## Console Output Guidelines

- **NEVER use console.log, console.error, or any console methods** - this is a console TUI application
- Console output will interfere with the terminal user interface
- Use proper error throwing and structured logging instead
- Let errors bubble up to be handled by the application's error handling system
