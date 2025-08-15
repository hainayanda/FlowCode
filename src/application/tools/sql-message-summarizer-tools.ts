import { Observable, Subject } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';
import { MessageReader } from '../interfaces/message-store.js';
import { SummarizerAgent, SummaryResult } from '../interfaces/summarizer-agent.js';
import { AgentMessage } from '../interfaces/agent.js';
import { DomainMessage, PlainMessage } from '../../presentation/view-models/console/console-use-case.js';

/**
 * SQL-based message summarization result interface
 */
export interface SqlMessageSummaryResult {
  summary: SummaryResult;
  searchType: 'sql';
  query: string;
  messagesFound: number;
}

/**
 * SQL-based message summarization tools implementation
 * Combines SQL message search with AI summarization capabilities
 */
export class SqlMessageSummarizerTools implements Toolbox {
  // Public getters
  readonly id = 'sql_message_summarizer_tools';
  readonly description = 'SQL-based message summarization toolbox for regex-based and filtered message summaries';

  // Private properties
  private readonly domainMessagesSubject = new Subject<DomainMessage>();

  /**
   * Observable stream of domain messages for rich UI updates
   */
  get domainMessages$(): Observable<DomainMessage> {
    return this.domainMessagesSubject.asObservable();
  }

  constructor(
    public readonly embeddingService: EmbeddingService,
    private readonly messageReader: MessageReader,
    private readonly summarizerAgent: SummarizerAgent
  ) {}

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'summarize_all_messages',
        description: 'Summarize all messages from conversation history using SQL store',
        parameters: [
          { name: 'limit', type: 'number', description: 'Maximum number of recent messages to summarize', required: false, default: 100 }
        ],
        permission: 'loose'
      },
      {
        name: 'summarize_messages_regex',
        description: 'Summarize messages matching a regex pattern using SQL search',
        parameters: [
          { name: 'pattern', type: 'string', description: 'Regex pattern to search for in message content', required: true },
          { name: 'limit', type: 'number', description: 'Maximum number of matching messages to summarize', required: false, default: 50 },
          { name: 'messageType', type: 'string', description: 'Filter by message type (user-input, system, ai-response, ai-thinking, error, file-operation)', required: false }
        ],
        permission: 'loose'
      },
      {
        name: 'summarize_messages_by_type',
        description: 'Summarize all messages of a specific type using SQL store',
        parameters: [
          { name: 'messageType', type: 'string', description: 'Message type to summarize (user-input, system, ai-response, ai-thinking, error, file-operation)', required: true },
          { name: 'limit', type: 'number', description: 'Maximum number of messages to summarize', required: false, default: 100 }
        ],
        permission: 'loose'
      }
    ];
  }

  supportsTool(toolName: string): boolean {
    return this.getTools().some(tool => tool.name === toolName);
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case 'summarize_all_messages':
          const allResult = await this.summarizeAllMessages(toolCall.parameters.limit);
          
          this.publishMessage(`Message summarization completed: ${allResult.messagesFound} messages processed`);
          
          return { 
            success: true, 
            data: allResult,
            message: `Summarized ${allResult.messagesFound} messages from conversation history`
          };

        case 'summarize_messages_regex':
          const regexResult = await this.summarizeMessagesRegex(
            toolCall.parameters.pattern,
            toolCall.parameters.limit,
            toolCall.parameters.messageType
          );
          
          this.publishMessage(`Message summarization completed: ${regexResult.messagesFound} messages processed`);
          
          return { 
            success: true, 
            data: regexResult,
            message: `Summarized ${regexResult.messagesFound} messages matching regex pattern`
          };

        case 'summarize_messages_by_type':
          const typeResult = await this.summarizeMessagesByType(
            toolCall.parameters.messageType,
            toolCall.parameters.limit
          );
          
          this.publishMessage(`Message summarization completed: ${typeResult.messagesFound} messages processed`);
          
          return { 
            success: true, 
            data: typeResult,
            message: `Summarized ${typeResult.messagesFound} messages of type '${toolCall.parameters.messageType}'`
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

  async summarizeAllMessages(limit: number = 100): Promise<SqlMessageSummaryResult> {
    const messages = await this.messageReader.getMessageHistory(limit);
    
    if (messages.length === 0) {
      throw new Error('No messages found to summarize');
    }

    const agentMessages = this.convertToAgentMessages(messages);
    const summary = await this.summarizerAgent.summarizeMessages(agentMessages);
    
    return {
      summary,
      searchType: 'sql',
      query: 'all recent messages',
      messagesFound: messages.length
    };
  }

  async summarizeMessagesRegex(
    pattern: string, 
    limit: number = 50, 
    messageType?: string
  ): Promise<SqlMessageSummaryResult> {
    const messageTypeFilter = messageType as DomainMessage['type'] | undefined;
    const messages = await this.messageReader.searchByRegex(pattern, limit, messageTypeFilter);
    
    if (messages.length === 0) {
      throw new Error(`No messages found matching regex pattern: ${pattern}`);
    }

    const agentMessages = this.convertToAgentMessages(messages);
    const summary = await this.summarizerAgent.summarizeMessages(agentMessages);
    
    return {
      summary,
      searchType: 'sql',
      query: `regex: ${pattern}`,
      messagesFound: messages.length
    };
  }

  async summarizeMessagesByType(
    messageType: string,
    limit: number = 100
  ): Promise<SqlMessageSummaryResult> {
    const messages = await this.messageReader.getMessagesByType(messageType as DomainMessage['type']);
    
    if (messages.length === 0) {
      throw new Error(`No messages found of type: ${messageType}`);
    }

    // Apply limit if specified
    const limitedMessages = limit > 0 ? messages.slice(-limit) : messages;
    
    const agentMessages = this.convertToAgentMessages(limitedMessages);
    const summary = await this.summarizerAgent.summarizeMessages(agentMessages);
    
    return {
      summary,
      searchType: 'sql',
      query: `type: ${messageType}`,
      messagesFound: limitedMessages.length
    };
  }

  private convertToAgentMessages(domainMessages: DomainMessage[]): AgentMessage[] {
    return domainMessages.map(msg => ({
      id: msg.id,
      type: this.mapDomainTypeToAgentType(msg.type),
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: 'metadata' in msg ? msg.metadata : undefined
    }));
  }

  private mapDomainTypeToAgentType(domainType: DomainMessage['type']): AgentMessage['type'] {
    switch (domainType) {
      case 'user-input':
        return 'user';
      case 'ai-response':
        return 'assistant';
      case 'ai-thinking':
        return 'thinking';
      case 'system':
      case 'error':
      case 'file-operation':
        return 'system';
      default:
        return 'system';
    }
  }

  private publishMessage(content: string): void {
    const message: PlainMessage = {
      id: this.generateMessageId(),
      type: 'system',
      content,
      timestamp: new Date()
    };
    
    this.domainMessagesSubject.next(message);
  }

  private generateMessageId(): string {
    return `sql_summarizer_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}