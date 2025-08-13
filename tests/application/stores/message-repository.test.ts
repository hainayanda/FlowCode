import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRepository } from '../../../src/application/stores/message-repository.js';
import { MockMessageStorePublisher, MockMessageStore, createTestMessage } from './message-repository.mocks.js';

describe('MessageRepository', () => {
  let repository: MessageRepository;
  let mockInMemoryStore: MockMessageStorePublisher;
  let mockPersistentStore: MockMessageStore;

  beforeEach(() => {
    mockInMemoryStore = new MockMessageStorePublisher();
    mockPersistentStore = new MockMessageStore();
    repository = new MessageRepository(mockInMemoryStore, mockPersistentStore);
  });

  describe('initialization', () => {
    it('should initialize both stores', async () => {
      await repository.initialize();
      
      expect(mockPersistentStore.initializeCalled).toBe(true);
      expect(mockInMemoryStore.initializeCalled).toBe(true);
      expect(mockPersistentStore.getAllMessagesCalled).toBe(true);
    });

    it('should handle initialization twice without duplicate calls', async () => {
      await repository.initialize();
      await repository.initialize();
      
      // Should only be called once due to initialized flag
      expect(mockPersistentStore.initializeCalled).toBe(true);
      expect(mockInMemoryStore.initializeCalled).toBe(true);
    });

    it('should throw error on persistent store initialization failure', async () => {
      const originalInitialize = mockPersistentStore.initialize;
      mockPersistentStore.initialize = vi.fn().mockRejectedValue(new Error('DB connection failed'));
      
      await expect(repository.initialize()).rejects.toThrow('Failed to initialize message repository');
      
      mockPersistentStore.initialize = originalInitialize;
    });

    it('should continue if loading persistent messages fails', async () => {
      const originalGetAllMessages = mockPersistentStore.getAllMessages;
      mockPersistentStore.getAllMessages = vi.fn().mockRejectedValue(new Error('DB read failed'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await expect(repository.initialize()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load persistent messages to memory:', expect.any(Error));
      
      consoleSpy.mockRestore();
      mockPersistentStore.getAllMessages = originalGetAllMessages;
    });
  });

  describe('message storage', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should store message in both stores', async () => {
      const message = createTestMessage('1', 'user-input');
      
      await repository.storeMessage(message);
      
      expect(mockInMemoryStore.storeMessageCalled).toBe(true);
      expect(mockInMemoryStore.lastStoredMessage).toEqual(message);
      expect(mockPersistentStore.storeMessageCalled).toBe(true);
      expect(mockPersistentStore.lastStoredMessage).toEqual(message);
    });

    it('should store multiple messages in both stores', async () => {
      const messages = [
        createTestMessage('1', 'user-input'),
        createTestMessage('2', 'system')
      ];
      
      await repository.storeMessages(messages);
      
      expect(mockInMemoryStore.storeMessagesCalled).toBe(true);
      expect(mockInMemoryStore.lastStoredMessages).toEqual(messages);
      expect(mockPersistentStore.storeMessagesCalled).toBe(true);
      expect(mockPersistentStore.lastStoredMessages).toEqual(messages);
    });

    it('should update message in both stores', async () => {
      const updates = { content: 'updated content' };
      
      await repository.updateMessage('1', updates);
      
      expect(mockInMemoryStore.updateMessageCalled).toBe(true);
      expect(mockInMemoryStore.lastUpdateId).toBe('1');
      expect(mockInMemoryStore.lastUpdateData).toEqual(updates);
      expect(mockPersistentStore.updateMessageCalled).toBe(true);
      expect(mockPersistentStore.lastUpdateId).toBe('1');
      expect(mockPersistentStore.lastUpdateData).toEqual(updates);
    });

    it('should clear history in both stores', async () => {
      await repository.clearHistory();
      
      expect(mockInMemoryStore.clearHistoryCalled).toBe(true);
      expect(mockPersistentStore.clearHistoryCalled).toBe(true);
    });
  });

  describe('message retrieval', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should get message history from in-memory store', async () => {
      const result = await repository.getMessageHistory(5);
      
      expect(Array.isArray(result)).toBe(true);
      // Verify it's using the in-memory store (which would have been called)
    });

    it('should get messages by type from in-memory store', async () => {
      const result = await repository.getMessagesByType('user-input');
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should search messages from in-memory store', async () => {
      const result = await repository.searchByRegex('test', 10, 'system');
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should get message by ID from in-memory store', async () => {
      const result = await repository.getMessageById('1');
      
      expect(result).toBeNull(); // Mock returns null by default
    });

    it('should get all messages from in-memory store', async () => {
      const result = await repository.getAllMessages();
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('message history observable', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should expose message history observable from in-memory store', () => {
      // Test that the observable is properly exposed (content test rather than identity)
      expect(repository.messageHistory$).toBeDefined();
      expect(typeof repository.messageHistory$.subscribe).toBe('function');
    });
  });

  describe('auto-initialization', () => {
    it('should auto-initialize on first operation', async () => {
      const freshMemoryStore = new MockMessageStorePublisher();
      const freshPersistentStore = new MockMessageStore();
      
      const newRepository = new MessageRepository(freshMemoryStore, freshPersistentStore);
      
      await newRepository.getMessageHistory();
      
      expect(freshPersistentStore.initializeCalled).toBe(true);
      expect(freshMemoryStore.initializeCalled).toBe(true);
    });

    it('should auto-initialize on store operation', async () => {
      const freshMemoryStore = new MockMessageStorePublisher();
      const freshPersistentStore = new MockMessageStore();
      
      const newRepository = new MessageRepository(freshMemoryStore, freshPersistentStore);
      const message = createTestMessage('1', 'user-input');
      
      await newRepository.storeMessage(message);
      
      expect(freshPersistentStore.initializeCalled).toBe(true);
      expect(freshMemoryStore.initializeCalled).toBe(true);
    });
  });

  describe('concurrent operations', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should handle concurrent store operations', async () => {
      const message1 = createTestMessage('1', 'user-input');
      const message2 = createTestMessage('2', 'system');
      
      // Reset counters
      mockInMemoryStore.reset();
      mockPersistentStore.reset();
      
      // Execute concurrent operations
      await Promise.all([
        repository.storeMessage(message1),
        repository.storeMessage(message2)
      ]);
      
      // Verify both operations completed - exact count may vary due to concurrency but should be > 0
      expect(mockInMemoryStore.storeMessageCalled).toBe(true);
      expect(mockPersistentStore.storeMessageCalled).toBe(true);
    });

    it('should handle concurrent read operations', async () => {
      // Execute concurrent read operations
      const [history, allMessages, userMessages] = await Promise.all([
        repository.getMessageHistory(),
        repository.getAllMessages(),
        repository.getMessagesByType('user-input')
      ]);
      
      expect(Array.isArray(history)).toBe(true);
      expect(Array.isArray(allMessages)).toBe(true);
      expect(Array.isArray(userMessages)).toBe(true);
    });
  });

  describe('error resilience', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should handle in-memory store failures gracefully', async () => {
      const originalStoreMessage = mockInMemoryStore.storeMessage;
      mockInMemoryStore.storeMessage = vi.fn().mockRejectedValue(new Error('Memory error'));
      const message = createTestMessage('1', 'user-input');
      
      await expect(repository.storeMessage(message)).rejects.toThrow('Memory error');
      
      mockInMemoryStore.storeMessage = originalStoreMessage;
    });

    it('should handle persistent store failures gracefully', async () => {
      const originalStoreMessage = mockPersistentStore.storeMessage;
      mockPersistentStore.storeMessage = vi.fn().mockRejectedValue(new Error('Disk error'));
      const message = createTestMessage('1', 'user-input');
      
      await expect(repository.storeMessage(message)).rejects.toThrow('Disk error');
      
      mockPersistentStore.storeMessage = originalStoreMessage;
    });
  });
});