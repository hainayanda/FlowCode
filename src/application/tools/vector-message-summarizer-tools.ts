import { Observable, EMPTY } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox, ToolboxMessage } from '../interfaces/toolbox.js';
import { EmbeddingService } from '../interfaces/embedding-service.js';
import { MessageVectorReader, RankedMessage } from '../interfaces/message-embedded-store.js';
import { SummarizerAgent, SummaryResult } from '../interfaces/summarizer-agent.js';
import { AgentMessage } from '../interfaces/agent.js';

/**
 * Vector-based message summarization result interface
 */
export interface VectorMessageSummaryResult {
  summary: SummaryResult;
  searchType: 'vector';
  query: string;
  messagesFound: number;
  averageRelevanceScore?: number;
}

/**
 * Vector-based message summarization tools implementation
 * Combines vector message search with AI summarization capabilities
 */
export class VectorMessageSummarizerTools implements Toolbox {
  
  readonly id = 'vector_message_summarizer_tools';
  readonly description = 'Vector-based message summarization toolbox for semantic similarity-based summaries';

  /**
   * Individual toolboxes don't emit messages - this is handled by ToolboxService
   */
  readonly messages$: Observable<ToolboxMessage> = EMPTY;

  constructor(
    public readonly embeddingService: EmbeddingService,
    private readonly messageVectorReader: MessageVectorReader,
    private readonly summarizerAgent: SummarizerAgent
  ) {}

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'summarize_messages_semantic',
        description: 'Summarize messages using natural language semantic search with vector similarity',
        parameters: [
          { name: 'query', type: 'string', description: 'Natural language query to find semantically similar messages to summarize', required: true },
          { name: 'limit', type: 'number', description: 'Maximum number of similar messages to summarize', required: false, default: 20 },
          { name: 'minRelevanceScore', type: 'number', description: 'Minimum relevance score (0-1) for messages to include', required: false, default: 0.7 }
        ],
        permission: 'loose'
      },
      {
        name: 'summarize_similar_messages',
        description: 'Summarize messages similar to a specific message using vector similarity',
        parameters: [
          { name: 'messageId', type: 'string', description: 'ID of the message to find similar messages for and summarize', required: true },
          { name: 'limit', type: 'number', description: 'Maximum number of similar messages to summarize', required: false, default: 15 },
          { name: 'minRelevanceScore', type: 'number', description: 'Minimum relevance score (0-1) for messages to include', required: false, default: 0.6 }
        ],
        permission: 'loose'
      },
      {
        name: 'check_vector_summarization_availability',
        description: 'Check if vector-based semantic summarization is available and configured',
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
        case 'summarize_messages_semantic':
          const semanticResult = await this.summarizeMessagesSemantic(
            toolCall.parameters.query,
            toolCall.parameters.limit,
            toolCall.parameters.minRelevanceScore
          );
          return { 
            success: true, 
            data: semanticResult,
            message: `Summarized ${semanticResult.messagesFound} semantically similar messages`
          };

        case 'summarize_similar_messages':
          const similarResult = await this.summarizeSimilarMessages(
            toolCall.parameters.messageId,
            toolCall.parameters.limit,
            toolCall.parameters.minRelevanceScore
          );
          return { 
            success: true, 
            data: similarResult,
            message: `Summarized ${similarResult.messagesFound} messages similar to specified message`
          };

        case 'check_vector_summarization_availability':
          const available = await this.checkVectorSummarizationAvailability();
          return { 
            success: true, 
            data: { available, searchType: 'vector' },
            message: `Vector summarization is ${available ? 'available' : 'not available'}`
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

  async summarizeMessagesSemantic(
    query: string, 
    limit: number = 20,
    minRelevanceScore: number = 0.7
  ): Promise<VectorMessageSummaryResult> {
    const rankedMessages = await this.messageVectorReader.searchByNaturalLanguage(query, limit);
    
    // Filter by minimum relevance score
    const filteredMessages = rankedMessages.filter(rm => rm.relevanceScore >= minRelevanceScore);
    
    if (filteredMessages.length === 0) {
      throw new Error(`No messages found with relevance score >= ${minRelevanceScore} for query: ${query}`);
    }

    const agentMessages = this.convertRankedToAgentMessages(filteredMessages);
    const summary = await this.summarizerAgent.summarizeMessages(agentMessages);
    
    const averageScore = filteredMessages.reduce((sum, rm) => sum + rm.relevanceScore, 0) / filteredMessages.length;
    
    return {
      summary,
      searchType: 'vector',
      query: `semantic: ${query}`,
      messagesFound: filteredMessages.length,
      averageRelevanceScore: averageScore
    };
  }

  async summarizeSimilarMessages(
    messageId: string,
    limit: number = 15,
    minRelevanceScore: number = 0.6
  ): Promise<VectorMessageSummaryResult> {
    const rankedMessages = await this.messageVectorReader.getSimilarMessages(messageId, limit);
    
    // Filter by minimum relevance score
    const filteredMessages = rankedMessages.filter(rm => rm.relevanceScore >= minRelevanceScore);
    
    if (filteredMessages.length === 0) {
      throw new Error(`No messages found with relevance score >= ${minRelevanceScore} similar to message: ${messageId}`);
    }

    const agentMessages = this.convertRankedToAgentMessages(filteredMessages);
    const summary = await this.summarizerAgent.summarizeMessages(agentMessages);
    
    const averageScore = filteredMessages.reduce((sum, rm) => sum + rm.relevanceScore, 0) / filteredMessages.length;
    
    return {
      summary,
      searchType: 'vector',
      query: `similar to: ${messageId}`,
      messagesFound: filteredMessages.length,
      averageRelevanceScore: averageScore
    };
  }

  async checkVectorSummarizationAvailability(): Promise<boolean> {
    return await this.messageVectorReader.isVectorSearchAvailable();
  }

  private convertRankedToAgentMessages(rankedMessages: RankedMessage[]): AgentMessage[] {
    return rankedMessages.map(rm => ({
      id: rm.message.id,
      type: this.mapDomainTypeToAgentType(rm.message.type),
      content: rm.message.content,
      timestamp: rm.message.timestamp,
      metadata: {
        ...rm.message.metadata,
        relevanceScore: rm.relevanceScore
      }
    }));
  }

  private mapDomainTypeToAgentType(domainType: string): AgentMessage['type'] {
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
}