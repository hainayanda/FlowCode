import { Observable, Subject } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';
import { MessageVectorReader, RankedMessage } from '../interfaces/message-embedded-store.js';
import { DomainMessage, PlainMessage } from '../../presentation/view-models/console/console-use-case.js';

/**
 * Vector message search result interface
 */
export interface VectorMessageSearchResult {
  rankedMessages: RankedMessage[];
  totalFound: number;
  searchType: 'vector';
  query: string;
}

/**
 * Vector availability result interface
 */
export interface VectorAvailabilityResult {
  available: boolean;
  searchType: 'vector';
}

/**
 * Vector-based message history search tools implementation
 * Provides semantic search and similarity matching using vector embeddings
 */
export class VectorMessageSearchTools implements Toolbox {
  // Public getters
  readonly id = 'vector_message_search_tools';
  readonly description = 'Vector-based message history search toolbox for semantic and similarity search';

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
    private readonly messageVectorReader: MessageVectorReader
  ) {}

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'search_messages_semantic',
        description: 'Search message history using natural language with vector-based semantic search',
        parameters: [
          { name: 'query', type: 'string', description: 'Natural language query to search for semantically similar messages', required: true },
          { name: 'limit', type: 'number', description: 'Maximum number of results to return', required: false, default: 10 }
        ],
        permission: 'none'
      },
      {
        name: 'get_similar_messages',
        description: 'Find messages similar to a specific message using vector similarity',
        parameters: [
          { name: 'messageId', type: 'string', description: 'ID of the message to find similar messages for', required: true },
          { name: 'limit', type: 'number', description: 'Maximum number of similar messages to return', required: false, default: 10 }
        ],
        permission: 'none'
      },
      {
        name: 'check_vector_search_availability',
        description: 'Check if vector-based semantic search is available and configured',
        parameters: [],
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
        case 'search_messages_semantic':
          const semanticResult = await this.searchMessagesSemantic(
            toolCall.parameters.query,
            toolCall.parameters.limit
          );
          
          this.publishMessage(`Semantic search completed: ${semanticResult.totalFound} results found`);
          
          return { 
            success: true, 
            data: semanticResult,
            message: `Found ${semanticResult.totalFound} semantically similar messages`
          };

        case 'get_similar_messages':
          const similarResult = await this.getSimilarMessages(
            toolCall.parameters.messageId,
            toolCall.parameters.limit
          );
          
          this.publishMessage(`Similarity search completed: ${similarResult.totalFound} results found`);
          
          return { 
            success: true, 
            data: similarResult,
            message: `Found ${similarResult.totalFound} similar messages`
          };

        case 'check_vector_search_availability':
          const availabilityResult = await this.checkVectorSearchAvailability();
          
          this.publishMessage(`Vector search availability checked: ${availabilityResult.available ? 'available' : 'not available'}`);
          
          return { 
            success: true, 
            data: availabilityResult,
            message: `Vector search is ${availabilityResult.available ? 'available' : 'not available'}`
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

  async searchMessagesSemantic(query: string, limit: number = 10): Promise<VectorMessageSearchResult> {
    const rankedMessages = await this.messageVectorReader.searchByNaturalLanguage(query, limit);
    
    return {
      rankedMessages,
      totalFound: rankedMessages.length,
      searchType: 'vector',
      query
    };
  }

  async getSimilarMessages(messageId: string, limit: number = 10): Promise<VectorMessageSearchResult> {
    const rankedMessages = await this.messageVectorReader.getSimilarMessages(messageId, limit);
    
    return {
      rankedMessages,
      totalFound: rankedMessages.length,
      searchType: 'vector',
      query: `similar to message: ${messageId}`
    };
  }

  async checkVectorSearchAvailability(): Promise<VectorAvailabilityResult> {
    const available = await this.messageVectorReader.isVectorSearchAvailable();
    
    return {
      available,
      searchType: 'vector'
    };
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
    return `vector_search_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}