# FlowCode Project Guidelines

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
