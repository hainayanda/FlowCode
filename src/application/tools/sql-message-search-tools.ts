import { Observable, EMPTY } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox, ToolboxMessage } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';
import { MessageReader } from '../interfaces/message-store.js';
import { DomainMessage } from '../../presentation/view-models/console/console-use-case.js';

/**
 * SQL message search result interface
 */
export interface SqlMessageSearchResult {
  messages: DomainMessage[];
  totalFound: number;
  searchType: 'sql';
  query: string;
}

/**
 * SQL-based message history search tools implementation
 * Provides regex search, type filtering, and history retrieval from SQL store
 */
export class SqlMessageSearchTools implements Toolbox {
  
  readonly id = 'sql_message_search_tools';
  readonly description = 'SQL-based message history search toolbox for regex and type-based queries';

  /**
   * Individual toolboxes don't emit messages - this is handled by ToolboxService
   */
  readonly messages$: Observable<ToolboxMessage> = EMPTY;

  constructor(
    public readonly embeddingService: EmbeddingService,
    private readonly messageReader: MessageReader
  ) {}

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'search_messages_regex',
        description: 'Search message history using regex pattern with SQL-based search',
        parameters: [
          { name: 'pattern', type: 'string', description: 'Regex pattern to search for in message content', required: true },
          { name: 'limit', type: 'number', description: 'Maximum number of results to return', required: false, default: 50 },
          { name: 'messageType', type: 'string', description: 'Filter by message type (user-input, system, ai-response, ai-thinking, error, file-operation)', required: false }
        ],
        permission: 'none'
      },
      {
        name: 'get_message_history',
        description: 'Get recent message history from SQL store',
        parameters: [
          { name: 'limit', type: 'number', description: 'Maximum number of recent messages to return', required: false, default: 100 }
        ],
        permission: 'none'
      },
      {
        name: 'get_messages_by_type',
        description: 'Get all messages of a specific type from SQL store',
        parameters: [
          { name: 'messageType', type: 'string', description: 'Message type to filter by (user-input, system, ai-response, ai-thinking, error, file-operation)', required: true }
        ],
        permission: 'none'
      },
      {
        name: 'get_message_by_id',
        description: 'Get a specific message by its ID from SQL store',
        parameters: [
          { name: 'messageId', type: 'string', description: 'Unique identifier of the message to retrieve', required: true }
        ],
        permission: 'none'
      }
    ];
  }

  supportsTool(toolName: string): boolean {
    return this.getTools().some(tool => tool.name === toolName);
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case 'search_messages_regex':
          const regexResult = await this.searchMessagesRegex(
            toolCall.parameters.pattern,
            toolCall.parameters.limit,
            toolCall.parameters.messageType
          );
          return { 
            success: true, 
            data: regexResult,
            message: `Found ${regexResult.totalFound} messages matching regex pattern`
          };

        case 'get_message_history':
          const historyResult = await this.getMessageHistory(toolCall.parameters.limit);
          return { 
            success: true, 
            data: historyResult,
            message: `Retrieved ${historyResult.totalFound} recent messages`
          };

        case 'get_messages_by_type':
          const typeResult = await this.getMessagesByType(toolCall.parameters.messageType);
          return { 
            success: true, 
            data: typeResult,
            message: `Found ${typeResult.totalFound} messages of type '${toolCall.parameters.messageType}'`
          };

        case 'get_message_by_id':
          const messageResult = await this.getMessageById(toolCall.parameters.messageId);
          if (messageResult.messages.length === 0) {
            return {
              success: false,
              message: `Message with ID '${toolCall.parameters.messageId}' not found`
            };
          }
          return { 
            success: true, 
            data: messageResult,
            message: `Retrieved message with ID '${toolCall.parameters.messageId}'`
          };

        default:
          return { success: false, error: `Unknown tool: ${toolCall.name}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  async searchMessagesRegex(
    pattern: string, 
    limit: number = 50, 
    messageType?: string
  ): Promise<SqlMessageSearchResult> {
    const messageTypeFilter = messageType as DomainMessage['type'] | undefined;
    const messages = await this.messageReader.searchByRegex(pattern, limit, messageTypeFilter);
    
    return {
      messages,
      totalFound: messages.length,
      searchType: 'sql',
      query: pattern
    };
  }

  async getMessageHistory(limit: number = 100): Promise<SqlMessageSearchResult> {
    const messages = await this.messageReader.getMessageHistory(limit);
    
    return {
      messages,
      totalFound: messages.length,
      searchType: 'sql',
      query: 'recent history'
    };
  }

  async getMessagesByType(messageType: string): Promise<SqlMessageSearchResult> {
    const messages = await this.messageReader.getMessagesByType(messageType as DomainMessage['type']);
    
    return {
      messages,
      totalFound: messages.length,
      searchType: 'sql',
      query: `type: ${messageType}`
    };
  }

  async getMessageById(messageId: string): Promise<SqlMessageSearchResult> {
    const message = await this.messageReader.getMessageById(messageId);
    const messages = message ? [message] : [];
    
    return {
      messages,
      totalFound: messages.length,
      searchType: 'sql',
      query: `id: ${messageId}`
    };
  }
}