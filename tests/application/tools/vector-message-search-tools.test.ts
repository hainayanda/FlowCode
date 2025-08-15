import { describe, it, expect, beforeEach } from 'vitest';
import { VectorMessageSearchTools } from '../../../src/application/tools/vector-message-search-tools.js';
import { MockMessageVectorReader, MockEmbeddingService } from './vector-message-search-tools.mocks.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

describe('VectorMessageSearchTools', () => {
  let vectorMessageSearchTools: VectorMessageSearchTools;
  let mockEmbeddingService: MockEmbeddingService;
  let mockMessageVectorReader: MockMessageVectorReader;

  const sampleMessages: DomainMessage[] = [
    {
      id: 'msg1',
      type: 'user-input',
      content: 'How to implement authentication?',
      timestamp: new Date('2024-01-01T10:00:00Z')
    },
    {
      id: 'msg2',
      type: 'system',
      content: 'Authentication can be implemented using JWT tokens',
      timestamp: new Date('2024-01-01T10:01:00Z')
    },
    {
      id: 'msg3',
      type: 'ai-response',
      content: 'Let me help you implement OAuth authentication',
      timestamp: new Date('2024-01-01T10:02:00Z'),
      metadata: {
        workerId: 'auth-worker'
      }
    }
  ];

  beforeEach(() => {
    mockEmbeddingService = new MockEmbeddingService();
    mockMessageVectorReader = new MockMessageVectorReader();

    vectorMessageSearchTools = new VectorMessageSearchTools(
      mockEmbeddingService,
      mockMessageVectorReader
    );

    // Setup default mock responses
    mockMessageVectorReader.mockRankedMessages = [
      { message: sampleMessages[0], relevanceScore: 0.9 },
      { message: sampleMessages[2], relevanceScore: 0.7 }
    ];
  });

  describe('Tool Registration', () => {
    it('should have correct toolbox identification', () => {
      expect(vectorMessageSearchTools.id).toBe('vector_message_search_tools');
      expect(vectorMessageSearchTools.description).toBe('Vector-based message history search toolbox for semantic and similarity search');
    });

    it('should register all vector search tools', () => {
      const tools = vectorMessageSearchTools.getTools();
      const toolNames = tools.map(tool => tool.name);

      expect(toolNames).toContain('search_messages_semantic');
      expect(toolNames).toContain('get_similar_messages');
      expect(toolNames).toContain('check_vector_search_availability');
      expect(toolNames).toHaveLength(3);
    });

    it('should support all registered tools', () => {
      expect(vectorMessageSearchTools.supportsTool('search_messages_semantic')).toBe(true);
      expect(vectorMessageSearchTools.supportsTool('get_similar_messages')).toBe(true);
      expect(vectorMessageSearchTools.supportsTool('check_vector_search_availability')).toBe(true);
      expect(vectorMessageSearchTools.supportsTool('unknown_tool')).toBe(false);
    });
  });

  describe('Vector Search Tools', () => {
    describe('search_messages_semantic', () => {
      it('should search messages using natural language', async () => {
        const result = await vectorMessageSearchTools.executeTool({
          name: 'search_messages_semantic',
          parameters: { query: 'how to secure user login', limit: 5 }
        });

        expect(result.success).toBe(true);
        expect(result.data.searchType).toBe('vector');
        expect(result.data.query).toBe('how to secure user login');
        expect(result.data.rankedMessages).toHaveLength(2);
        expect(result.data.totalFound).toBe(2);
        expect(mockMessageVectorReader.lastNaturalLanguageQuery).toBe('how to secure user login');
        expect(mockMessageVectorReader.lastNaturalLanguageLimit).toBe(5);
      });

      it('should use default limit when not specified', async () => {
        await vectorMessageSearchTools.executeTool({
          name: 'search_messages_semantic',
          parameters: { query: 'test query' }
        });

        expect(mockMessageVectorReader.lastNaturalLanguageLimit).toBe(10);
      });
    });

    describe('get_similar_messages', () => {
      it('should find similar messages by message ID', async () => {
        const result = await vectorMessageSearchTools.executeTool({
          name: 'get_similar_messages',
          parameters: { messageId: 'msg1', limit: 3 }
        });

        expect(result.success).toBe(true);
        expect(result.data.searchType).toBe('vector');
        expect(result.data.query).toBe('similar to message: msg1');
        expect(result.data.rankedMessages).toHaveLength(2);
        expect(mockMessageVectorReader.lastSimilarMessageId).toBe('msg1');
        expect(mockMessageVectorReader.lastSimilarLimit).toBe(3);
      });

      it('should use default limit when not specified', async () => {
        await vectorMessageSearchTools.executeTool({
          name: 'get_similar_messages',
          parameters: { messageId: 'msg2' }
        });

        expect(mockMessageVectorReader.lastSimilarLimit).toBe(10);
      });
    });

    describe('check_vector_search_availability', () => {
      it('should check if vector search is available', async () => {
        mockMessageVectorReader.isAvailable = true;

        const result = await vectorMessageSearchTools.executeTool({
          name: 'check_vector_search_availability',
          parameters: {}
        });

        expect(result.success).toBe(true);
        expect(result.data.available).toBe(true);
        expect(result.data.searchType).toBe('vector');
        expect(result.message).toBe('Vector search is available');
        expect(mockMessageVectorReader.availabilityCheckCalled).toBe(true);
      });

      it('should handle unavailable vector search', async () => {
        mockMessageVectorReader.isAvailable = false;

        const result = await vectorMessageSearchTools.executeTool({
          name: 'check_vector_search_availability',
          parameters: {}
        });

        expect(result.success).toBe(true);
        expect(result.data.available).toBe(false);
        expect(result.data.searchType).toBe('vector');
        expect(result.message).toBe('Vector search is not available');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool calls', async () => {
      const result = await vectorMessageSearchTools.executeTool({
        name: 'unknown_tool',
        parameters: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: unknown_tool');
    });

    it('should handle vector search errors', async () => {
      mockMessageVectorReader.shouldThrowError = true;

      const result = await vectorMessageSearchTools.executeTool({
        name: 'search_messages_semantic',
        parameters: { query: 'test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });

    it('should handle similar messages errors', async () => {
      mockMessageVectorReader.shouldThrowError = true;

      const result = await vectorMessageSearchTools.executeTool({
        name: 'get_similar_messages',
        parameters: { messageId: 'test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });

    it('should handle availability check errors', async () => {
      mockMessageVectorReader.shouldThrowError = true;

      const result = await vectorMessageSearchTools.executeTool({
        name: 'check_vector_search_availability',
        parameters: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });
  });

  describe('Direct Method Calls', () => {
    it('should search messages semantically directly', async () => {
      const result = await vectorMessageSearchTools.searchMessagesSemantic('login security', 8);

      expect(result.searchType).toBe('vector');
      expect(result.query).toBe('login security');
      expect(result.rankedMessages).toHaveLength(2);
      expect(mockMessageVectorReader.lastNaturalLanguageQuery).toBe('login security');
      expect(mockMessageVectorReader.lastNaturalLanguageLimit).toBe(8);
    });

    it('should get similar messages directly', async () => {
      const result = await vectorMessageSearchTools.getSimilarMessages('msg3', 6);

      expect(result.searchType).toBe('vector');
      expect(result.query).toBe('similar to message: msg3');
      expect(mockMessageVectorReader.lastSimilarMessageId).toBe('msg3');
      expect(mockMessageVectorReader.lastSimilarLimit).toBe(6);
    });

    it('should check vector availability directly', async () => {
      mockMessageVectorReader.isAvailable = true;
      const result = await vectorMessageSearchTools.checkVectorSearchAvailability();

      expect(result.available).toBe(true);
      expect(result.searchType).toBe('vector');
      expect(mockMessageVectorReader.availabilityCheckCalled).toBe(true);
    });

    it('should handle unavailable vector search in direct call', async () => {
      mockMessageVectorReader.isAvailable = false;
      const result = await vectorMessageSearchTools.checkVectorSearchAvailability();

      expect(result.available).toBe(false);
      expect(result.searchType).toBe('vector');
    });
  });
});