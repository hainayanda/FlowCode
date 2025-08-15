import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageVectorRepository } from '../../../../src/application/stores/vector/message-vector-repository.js';
import { 
  MockVectorStore, 
  MockEmbeddingService, 
  MockMessageReader, 
  createTestMessage,
  createTestVectorResult 
} from './message-vector-repository.mocks.js';

describe('MessageVectorRepository', () => {
  let repository: MessageVectorRepository;
  let mockVectorStore: MockVectorStore;
  let mockEmbeddingService: MockEmbeddingService;
  let mockMessageStore: MockMessageReader;

  beforeEach(() => {
    mockVectorStore = new MockVectorStore();
    mockEmbeddingService = new MockEmbeddingService();
    mockMessageStore = new MockMessageReader();
    
    repository = new MessageVectorRepository(
      mockVectorStore,
      mockEmbeddingService,
      mockMessageStore
    );
  });

  describe('initialization', () => {
    it('should initialize vector store on first operation', async () => {
      await repository.isVectorSearchAvailable();
      
      expect(mockVectorStore.initializeCalled).toBe(true);
    });

    it('should handle initialization errors', async () => {
      mockVectorStore.initialize = async () => {
        throw new Error('Initialization failed');
      };
      
      // isVectorSearchAvailable should return false when initialization fails
      const available = await repository.isVectorSearchAvailable();
      expect(available).toBe(false);
    });
  });

  describe('availability checks', () => {
    it('should return true when vector search is available', async () => {
      mockEmbeddingService.setAvailable(true);
      
      const available = await repository.isVectorSearchAvailable();
      expect(available).toBe(true);
    });

    it('should return false when embedding service is not available', async () => {
      mockEmbeddingService.setAvailable(false);
      
      const available = await repository.isVectorSearchAvailable();
      expect(available).toBe(false);
    });

    it('should return false when embedding is not enabled', async () => {
      mockEmbeddingService.setAvailable(false);
      
      const enabled = await repository.isEmbeddingEnabled();
      expect(enabled).toBe(false);
    });
  });

  describe('natural language search', () => {
    beforeEach(async () => {
      // Setup test messages and vectors
      const message1 = createTestMessage('msg-1', 'ai-response', 'JavaScript async function');
      const message2 = createTestMessage('msg-2', 'ai-response', 'Python data processing');
      
      mockMessageStore.addMessage(message1);
      mockMessageStore.addMessage(message2);
      
      // Setup mock search results
      const vectorResults = [
        createTestVectorResult('msg-1', [0.1, 0.2, 0.3], { messageId: 'msg-1' }, 0.1),
        createTestVectorResult('msg-2', [0.4, 0.5, 0.6], { messageId: 'msg-2' }, 0.3)
      ];
      mockVectorStore.setSearchResults(vectorResults);
      
      mockEmbeddingService.setAvailable(true);
    });

    it('should search messages by natural language query', async () => {
      const query = 'async programming';
      const results = await repository.searchByNaturalLanguage(query, 5);
      
      expect(results).toHaveLength(2);
      expect(results[0].message.id).toBe('msg-1');
      expect(results[0].relevanceScore).toBeCloseTo(0.9, 1); // 1 - 0.1 = 0.9
      expect(results[1].message.id).toBe('msg-2');
      expect(results[1].relevanceScore).toBeCloseTo(0.7, 1); // 1 - 0.3 = 0.7
      
      // Verify embedding service was called
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain(query);
      
      // Verify vector store was called
      expect(mockVectorStore.searchSimilarCalls).toHaveLength(1);
      expect(mockVectorStore.searchSimilarCalls[0].limit).toBe(5);
    });

    it('should return empty results when embedding service is not available', async () => {
      mockEmbeddingService.setAvailable(false);
      
      const results = await repository.searchByNaturalLanguage('test query');
      
      expect(results).toHaveLength(0);
    });

    it('should handle search errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalSearchSimilar = mockVectorStore.searchSimilar;
      mockVectorStore.searchSimilar = async () => {
        throw new Error('Search failed');
      };
      
      const results = await repository.searchByNaturalLanguage('test query');
      
      expect(results).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Vector search failed, falling back to empty results:', expect.any(Error));
      
      // Restore original method and console
      mockVectorStore.searchSimilar = originalSearchSimilar;
      consoleWarnSpy.mockRestore();
    });

    it('should sort results by relevance then timestamp', async () => {
      const oldMessage = createTestMessage('msg-old', 'ai-response', 'Old content', {
        timestamp: new Date('2023-01-01')
      });
      const newMessage = createTestMessage('msg-new', 'ai-response', 'New content', {
        timestamp: new Date('2023-12-01')
      });
      
      mockMessageStore.addMessage(oldMessage);
      mockMessageStore.addMessage(newMessage);
      
      // Same relevance score, should sort by timestamp
      const vectorResults = [
        createTestVectorResult('msg-old', [0.1, 0.2, 0.3], { messageId: 'msg-old' }, 0.2),
        createTestVectorResult('msg-new', [0.4, 0.5, 0.6], { messageId: 'msg-new' }, 0.2)
      ];
      mockVectorStore.setSearchResults(vectorResults);
      
      const results = await repository.searchByNaturalLanguage('test query');
      
      // Newer message should come first when relevance is equal
      expect(results[0].message.id).toBe('msg-new');
      expect(results[1].message.id).toBe('msg-old');
    });
  });

  describe('similar message search', () => {
    beforeEach(async () => {
      const message1 = createTestMessage('msg-1', 'ai-response', 'Original message');
      const message2 = createTestMessage('msg-2', 'ai-response', 'Similar message');
      
      mockMessageStore.addMessage(message1);
      mockMessageStore.addMessage(message2);
      
      mockEmbeddingService.setAvailable(true);
    });

    it('should find similar messages to a given message', async () => {
      const vectorResults = [
        createTestVectorResult('msg-1', [0.1, 0.2, 0.3], { messageId: 'msg-1' }, 0.0), // Original (should be filtered)
        createTestVectorResult('msg-2', [0.4, 0.5, 0.6], { messageId: 'msg-2' }, 0.2)  // Similar
      ];
      mockVectorStore.setSearchResults(vectorResults);
      
      const results = await repository.getSimilarMessages('msg-1', 5);
      
      expect(results).toHaveLength(1);
      expect(results[0].message.id).toBe('msg-2'); // Original should be filtered out
      
      // Verify message was retrieved to generate embedding
      expect(mockMessageStore.getMessageByIdCalls).toContain('msg-1');
      
      // Verify embedding was generated for original message content
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain('test-worker: Original message');
    });

    it('should return empty results when original message not found', async () => {
      const results = await repository.getSimilarMessages('non-existent', 5);
      
      expect(results).toHaveLength(0);
    });

    it('should handle search errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalGenerateEmbedding = mockEmbeddingService.generateEmbedding;
      mockEmbeddingService.generateEmbedding = async () => {
        throw new Error('Embedding failed');
      };
      
      const results = await repository.getSimilarMessages('msg-1', 5);
      
      expect(results).toHaveLength(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Similar message search failed:', expect.any(Error));
      
      // Restore original method and console
      mockEmbeddingService.generateEmbedding = originalGenerateEmbedding;
      consoleWarnSpy.mockRestore();
    });
  });

  describe('vector storage operations', () => {
    beforeEach(() => {
      mockEmbeddingService.setAvailable(true);
    });

    it('should store message with embedding', async () => {
      const message = createTestMessage('msg-1', 'user-input', 'Test message');
      
      await repository.storeMessageWithEmbedding(message);
      
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain('Test message');
      expect(mockVectorStore.storeVectorCalls).toHaveLength(1);
      
      const storeCall = mockVectorStore.storeVectorCalls[0];
      expect(storeCall.id).toBe('msg-1');
      expect(storeCall.metadata).toEqual({
        messageId: 'msg-1',
        type: 'user-input',
        timestamp: message.timestamp,
        content: 'Test message'
      });
    });

    it('should skip storing when embedding service is not available', async () => {
      mockEmbeddingService.setAvailable(false);
      
      const message = createTestMessage('msg-1', 'user-input', 'Test message');
      await repository.storeMessageWithEmbedding(message);
      
      expect(mockVectorStore.storeVectorCalls).toHaveLength(0);
    });

    it('should handle storage errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const originalGenerateEmbedding = mockEmbeddingService.generateEmbedding;
      mockEmbeddingService.generateEmbedding = async () => {
        throw new Error('Embedding failed');
      };
      
      const message = createTestMessage('msg-1', 'user-input', 'Test message');
      
      // Should not throw, just log warning
      await expect(repository.storeMessageWithEmbedding(message)).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to store message embedding:', expect.any(Error));
      
      // Restore original method and console
      mockEmbeddingService.generateEmbedding = originalGenerateEmbedding;
      consoleWarnSpy.mockRestore();
    });

    it('should update message embedding', async () => {
      const message = createTestMessage('msg-1', 'ai-response', 'Updated content');
      
      await repository.updateMessageEmbedding('msg-1', message);
      
      expect(mockVectorStore.updateVectorCalls).toHaveLength(1);
      expect(mockVectorStore.updateVectorCalls[0].id).toBe('msg-1');
      expect(mockVectorStore.updateVectorCalls[0].metadata.content).toBe('test-worker: Updated content');
    });

    it('should remove message embedding', async () => {
      await repository.removeMessageEmbedding('msg-1');
      
      expect(mockVectorStore.removeVectorCalls).toContain('msg-1');
    });

    it('should clear all embeddings', async () => {
      await repository.clearAllEmbeddings();
      
      expect(mockVectorStore.clearAllCalled).toBe(true);
    });
  });

  describe('text extraction from messages', () => {
    beforeEach(() => {
      mockEmbeddingService.setAvailable(true);
    });

    it('should extract text from user input messages', async () => {
      const message = createTestMessage('msg-1', 'user-input', 'User question');
      
      await repository.storeMessageWithEmbedding(message);
      
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain('User question');
    });

    it('should extract text from AI response messages with worker ID', async () => {
      const message = createTestMessage('msg-1', 'ai-response', 'AI response', {
        metadata: { workerId: 'code-worker', isStreaming: false }
      });
      
      await repository.storeMessageWithEmbedding(message);
      
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain('code-worker: AI response');
    });

    it('should extract text from error messages', async () => {
      const message = createTestMessage('msg-1', 'error', 'Something went wrong');
      
      await repository.storeMessageWithEmbedding(message);
      
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain('Error: Something went wrong');
    });

    it('should extract text from file operation messages', async () => {
      const message = createTestMessage('msg-1', 'file-operation', 'File changes', {
        metadata: {
          filePath: '/src/app.ts',
          fileOperation: 'edit' as const,
          diffs: []
        }
      });
      
      await repository.storeMessageWithEmbedding(message);
      
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain('edit /src/app.ts: File changes');
    });

    it('should extract text from user choice messages', async () => {
      const message = createTestMessage('msg-1', 'user-choice', 'Selected option A', {
        metadata: {
          prompt: 'Choose an option',
          choices: ['A', 'B'],
          selectedIndex: 0
        }
      });
      
      await repository.storeMessageWithEmbedding(message);
      
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain('Choose an option: Selected option A');
    });
  });

  describe('rebuild embeddings', () => {
    beforeEach(() => {
      mockEmbeddingService.setAvailable(true);
    });

    it('should rebuild embeddings for all messages', async () => {
      const messages = [
        createTestMessage('msg-1', 'user-input', 'Message 1'),
        createTestMessage('msg-2', 'ai-response', 'Message 2')
      ];
      
      await repository.rebuildEmbeddings(messages);
      
      expect(mockVectorStore.clearAllCalled).toBe(true);
      expect(mockVectorStore.storeVectorCalls).toHaveLength(2);
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain('Message 1');
      expect(mockEmbeddingService.generateEmbeddingCalls).toContain('test-worker: Message 2');
    });

    it('should skip rebuild when embedding service is not available', async () => {
      mockEmbeddingService.setAvailable(false);
      
      const messages = [createTestMessage('msg-1', 'user-input', 'Message 1')];
      await repository.rebuildEmbeddings(messages);
      
      expect(mockVectorStore.clearAllCalled).toBe(false);
      expect(mockVectorStore.storeVectorCalls).toHaveLength(0);
    });
  });

  describe('error resilience', () => {
    it('should handle vector store failures gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockEmbeddingService.setAvailable(true);
      const originalStoreVector = mockVectorStore.storeVector;
      mockVectorStore.storeVector = async () => {
        throw new Error('Vector store failed');
      };
      
      const message = createTestMessage('msg-1', 'user-input', 'Test message');
      
      // Should not throw, just log warning
      await expect(repository.storeMessageWithEmbedding(message)).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to store message embedding:', expect.any(Error));
      
      // Restore original method and console
      mockVectorStore.storeVector = originalStoreVector;
      consoleWarnSpy.mockRestore();
    });

    it('should handle missing messages in search results', async () => {
      const vectorResults = [
        createTestVectorResult('non-existent', [0.1, 0.2, 0.3], { messageId: 'non-existent' }, 0.1)
      ];
      mockVectorStore.setSearchResults(vectorResults);
      mockEmbeddingService.setAvailable(true);
      
      const results = await repository.searchByNaturalLanguage('test query');
      
      // Should filter out non-existent messages
      expect(results).toHaveLength(0);
    });
  });
});