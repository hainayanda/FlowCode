import { describe, it, expect, beforeEach } from 'vitest';
import { VectorMessageSummarizerTools } from '../../../src/application/tools/vector-message-summarizer-tools.js';
import { SummarizerAgent, SummaryResult } from '../../../src/application/interfaces/summarizer-agent.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';
import { MessageVectorReader, RankedMessage } from '../../../src/application/interfaces/message-embedded-store.js';
import { AgentMessage } from '../../../src/application/interfaces/agent.js';
import { ToolCall } from '../../../src/application/interfaces/toolbox.js';

// Mock implementations
class MockMessageVectorReader implements MessageVectorReader {
  searchByNaturalLanguageCallCount = 0;
  getSimilarMessagesCallCount = 0;
  isVectorSearchAvailableCallCount = 0;
  
  lastQuery = '';
  lastMessageId = '';
  lastLimit = 0;

  private mockRankedMessages: RankedMessage[] = [
    {
      message: {
        id: 'msg1',
        type: 'user-input',
        content: 'I need help with JWT authentication setup',
        timestamp: new Date('2024-01-01T10:00:00Z')
      },
      relevanceScore: 0.95
    },
    {
      message: {
        id: 'msg2',
        type: 'ai-response',
        content: 'Here is how to implement JWT authentication with proper security',
        timestamp: new Date('2024-01-01T10:01:00Z'),
        metadata: { workerId: 'test-worker' }
      },
      relevanceScore: 0.88
    },
    {
      message: {
        id: 'msg3',
        type: 'user-input',
        content: 'What about password hashing best practices?',
        timestamp: new Date('2024-01-01T10:02:00Z')
      },
      relevanceScore: 0.75
    }
  ];

  async searchByNaturalLanguage(query: string, limit: number): Promise<RankedMessage[]> {
    this.searchByNaturalLanguageCallCount++;
    this.lastQuery = query;
    this.lastLimit = limit;
    return this.mockRankedMessages.slice(0, limit);
  }

  async getSimilarMessages(messageId: string, limit: number): Promise<RankedMessage[]> {
    this.getSimilarMessagesCallCount++;
    this.lastMessageId = messageId;
    this.lastLimit = limit;
    return this.mockRankedMessages.slice(0, limit);
  }

  async isVectorSearchAvailable(): Promise<boolean> {
    this.isVectorSearchAvailableCallCount++;
    return true;
  }
}

class MockSummarizerAgent implements SummarizerAgent {
  summarizeCallCount = 0;
  lastMessagesReceived: AgentMessage[] = [];

  async summarizeMessages(messages: AgentMessage[]): Promise<SummaryResult> {
    this.summarizeCallCount++;
    this.lastMessagesReceived = messages;
    
    return {
      summary: `Vector-based summary of ${messages.length} messages about authentication and security`,
      messageCount: messages.length,
      timeSpan: messages.length > 0 ? {
        start: messages[0].timestamp,
        end: messages[messages.length - 1].timestamp
      } : undefined,
      tokenUsage: {
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300
      }
    };
  }
}

class MockEmbeddingService implements EmbeddingService {
  async generateEmbedding(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3, 0.4, 0.5];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3, 0.4, 0.5]);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getEmbeddingDimension(): number {
    return 5;
  }
}

describe('VectorMessageSummarizerTools', () => {
  let vectorSummarizerTools: VectorMessageSummarizerTools;
  let mockMessageVectorReader: MockMessageVectorReader;
  let mockSummarizerAgent: MockSummarizerAgent;
  let mockEmbeddingService: MockEmbeddingService;

  beforeEach(() => {
    mockMessageVectorReader = new MockMessageVectorReader();
    mockSummarizerAgent = new MockSummarizerAgent();
    mockEmbeddingService = new MockEmbeddingService();
    vectorSummarizerTools = new VectorMessageSummarizerTools(
      mockEmbeddingService,
      mockMessageVectorReader,
      mockSummarizerAgent
    );
  });

  describe('toolbox interface', () => {
    it('should have correct id and description', () => {
      expect(vectorSummarizerTools.id).toBe('vector_message_summarizer_tools');
      expect(vectorSummarizerTools.description).toBe('Vector-based message summarization toolbox for semantic similarity-based summaries');
    });

    it('should return correct tool definitions', () => {
      const tools = vectorSummarizerTools.getTools();
      expect(tools).toHaveLength(3);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('summarize_messages_semantic');
      expect(toolNames).toContain('summarize_similar_messages');
      expect(toolNames).toContain('check_vector_summarization_availability');
    });

    it('should support all its defined tools', () => {
      expect(vectorSummarizerTools.supportsTool('summarize_messages_semantic')).toBe(true);
      expect(vectorSummarizerTools.supportsTool('summarize_similar_messages')).toBe(true);
      expect(vectorSummarizerTools.supportsTool('check_vector_summarization_availability')).toBe(true);
      expect(vectorSummarizerTools.supportsTool('unknown_tool')).toBe(false);
    });
  });

  describe('summarize_messages_semantic tool', () => {
    it('should successfully summarize semantically similar messages', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_messages_semantic',
        parameters: { 
          query: 'authentication security',
          limit: 10,
          minRelevanceScore: 0.7
        }
      };

      const result = await vectorSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.summary.summary).toContain('authentication and security');
      expect(result.data.messagesFound).toBe(3); // All messages have score >= 0.7
      expect(result.data.searchType).toBe('vector');
      expect(result.data.query).toBe('semantic: authentication security');
      expect(result.data.averageRelevanceScore).toBeCloseTo(0.86, 2); // (0.95 + 0.88 + 0.75) / 3
      expect(mockMessageVectorReader.searchByNaturalLanguageCallCount).toBe(1);
      expect(mockSummarizerAgent.summarizeCallCount).toBe(1);
    });

    it('should filter by minimum relevance score', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_messages_semantic',
        parameters: { 
          query: 'authentication',
          minRelevanceScore: 0.9 // Only first message should pass
        }
      };

      const result = await vectorSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.messagesFound).toBe(1); // Only msg1 with score 0.95
      expect(mockSummarizerAgent.lastMessagesReceived).toHaveLength(1);
      expect(mockSummarizerAgent.lastMessagesReceived[0].id).toBe('msg1');
    });

    it('should handle no messages meeting relevance threshold', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_messages_semantic',
        parameters: { 
          query: 'authentication',
          minRelevanceScore: 0.99 // No messages should pass
        }
      };

      const result = await vectorSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No messages found with relevance score >= 0.99');
    });

    it('should use default parameters when not specified', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_messages_semantic',
        parameters: { query: 'test query' }
      };

      await vectorSummarizerTools.executeTool(toolCall);

      expect(mockMessageVectorReader.lastLimit).toBe(20); // Default limit
      expect(mockSummarizerAgent.lastMessagesReceived).toHaveLength(3); // All pass default 0.7 threshold
    });
  });

  describe('summarize_similar_messages tool', () => {
    it('should successfully summarize messages similar to specified message', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_similar_messages',
        parameters: { 
          messageId: 'msg1',
          limit: 5,
          minRelevanceScore: 0.6
        }
      };

      const result = await vectorSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.searchType).toBe('vector');
      expect(result.data.query).toBe('similar to: msg1');
      expect(result.data.messagesFound).toBe(3); // All messages have score >= 0.6
      expect(mockMessageVectorReader.getSimilarMessagesCallCount).toBe(1);
      expect(mockMessageVectorReader.lastMessageId).toBe('msg1');
      expect(mockSummarizerAgent.summarizeCallCount).toBe(1);
    });

    it('should filter by minimum relevance score', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_similar_messages',
        parameters: { 
          messageId: 'msg1',
          minRelevanceScore: 0.8 // Only first two messages should pass
        }
      };

      const result = await vectorSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.messagesFound).toBe(2); // msg1 (0.95) and msg2 (0.88)
      expect(result.data.averageRelevanceScore).toBeCloseTo(0.915, 3); // (0.95 + 0.88) / 2
    });

    it('should handle no similar messages meeting threshold', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_similar_messages',
        parameters: { 
          messageId: 'msg1',
          minRelevanceScore: 0.99
        }
      };

      const result = await vectorSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No messages found with relevance score >= 0.99 similar to message: msg1');
    });

    it('should use default parameters when not specified', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_similar_messages',
        parameters: { messageId: 'msg1' }
      };

      await vectorSummarizerTools.executeTool(toolCall);

      expect(mockMessageVectorReader.lastLimit).toBe(15); // Default limit
      expect(mockSummarizerAgent.lastMessagesReceived).toHaveLength(3); // All pass default 0.6 threshold
    });
  });

  describe('check_vector_summarization_availability tool', () => {
    it('should check vector summarization availability', async () => {
      const toolCall: ToolCall = {
        name: 'check_vector_summarization_availability',
        parameters: {}
      };

      const result = await vectorSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.available).toBe(true);
      expect(result.data.searchType).toBe('vector');
      expect(mockMessageVectorReader.isVectorSearchAvailableCallCount).toBe(1);
    });

    it('should handle unavailable vector search', async () => {
      // Override mock to return false
      mockMessageVectorReader.isVectorSearchAvailable = async () => false;

      const toolCall: ToolCall = {
        name: 'check_vector_summarization_availability',
        parameters: {}
      };

      const result = await vectorSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.available).toBe(false);
      expect(result.message).toContain('not available');
    });
  });

  describe('message conversion', () => {
    it('should correctly convert ranked messages to agent messages with relevance scores', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_messages_semantic',
        parameters: { query: 'test' }
      };

      await vectorSummarizerTools.executeTool(toolCall);

      const agentMessages = mockSummarizerAgent.lastMessagesReceived;
      expect(agentMessages).toHaveLength(3);
      
      // Check that relevance scores are preserved in metadata
      expect(agentMessages[0].metadata?.relevanceScore).toBe(0.95);
      expect(agentMessages[1].metadata?.relevanceScore).toBe(0.88);
      expect(agentMessages[2].metadata?.relevanceScore).toBe(0.75);
      
      // Check type mapping
      expect(agentMessages[0].type).toBe('user'); // user-input -> user
      expect(agentMessages[1].type).toBe('assistant'); // ai-response -> assistant
      expect(agentMessages[2].type).toBe('user'); // user-input -> user
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const toolCall: ToolCall = {
        name: 'unknown_tool',
        parameters: {}
      };

      const result = await vectorSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: unknown_tool');
    });
  });
});