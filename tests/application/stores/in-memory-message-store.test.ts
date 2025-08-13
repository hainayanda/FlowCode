import { describe, it, expect, beforeEach } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { InMemoryMessageStore } from '../../../src/application/stores/in-memory-message-store.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

describe('InMemoryMessageStore', () => {
  let store: InMemoryMessageStore;

  beforeEach(async () => {
    store = new InMemoryMessageStore();
    await store.initialize();
  });

  const createTestMessage = (id: string, type: DomainMessage['type'] = 'user-input', content = 'test content'): DomainMessage => {
    const base = {
      id,
      content,
      timestamp: new Date()
    };

    switch (type) {
      case 'user-input':
      case 'system':
        return { ...base, type };
      case 'ai-response':
      case 'ai-thinking':
        return { ...base, type, metadata: { workerId: 'test-worker' } };
      case 'error':
        return { ...base, type, metadata: {} };
      case 'file-operation':
        return { ...base, type, metadata: { filePath: '/test/file.ts', fileOperation: 'edit' } };
      case 'user-choice':
        return { ...base, type, metadata: { choices: ['yes', 'no'], selectedIndex: -1, prompt: 'test?' } };
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  };

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newStore = new InMemoryMessageStore();
      await expect(newStore.initialize()).resolves.toBeUndefined();
    });
  });

  describe('message storage', () => {
    it('should store a single message', async () => {
      const message = createTestMessage('1', 'user-input');
      
      await store.storeMessage(message);
      
      const retrieved = await store.getMessageById('1');
      expect(retrieved).toEqual(message);
    });

    it('should store multiple messages', async () => {
      const messages = [
        createTestMessage('1', 'user-input'),
        createTestMessage('2', 'system'),
        createTestMessage('3', 'ai-response')
      ];
      
      await store.storeMessages(messages);
      
      const allMessages = await store.getAllMessages();
      expect(allMessages).toHaveLength(3);
      expect(allMessages).toEqual(expect.arrayContaining(messages));
    });

    it('should replace message with same ID', async () => {
      const original = createTestMessage('1', 'user-input', 'original content');
      const updated = createTestMessage('1', 'user-input', 'updated content');
      
      await store.storeMessage(original);
      await store.storeMessage(updated);
      
      const retrieved = await store.getMessageById('1');
      expect(retrieved?.content).toBe('updated content');
      
      const allMessages = await store.getAllMessages();
      expect(allMessages).toHaveLength(1);
    });
  });

  describe('message retrieval', () => {
    beforeEach(async () => {
      const messages = [
        createTestMessage('1', 'user-input', 'hello world'),
        createTestMessage('2', 'system', 'system message'),
        createTestMessage('3', 'ai-response', 'ai response'),
        createTestMessage('4', 'user-input', 'another user input'),
        createTestMessage('5', 'error', 'error message')
      ];
      await store.storeMessages(messages);
    });

    it('should get message by ID', async () => {
      const message = await store.getMessageById('3');
      expect(message?.type).toBe('ai-response');
      expect(message?.content).toBe('ai response');
    });

    it('should return null for non-existent message ID', async () => {
      const message = await store.getMessageById('non-existent');
      expect(message).toBeNull();
    });

    it('should get all messages', async () => {
      const allMessages = await store.getAllMessages();
      expect(allMessages).toHaveLength(5);
    });

    it('should get message history with limit', async () => {
      const history = await store.getMessageHistory(3);
      expect(history).toHaveLength(3);
    });

    it('should get message history without limit', async () => {
      const history = await store.getMessageHistory();
      expect(history).toHaveLength(5);
    });

    it('should get messages by type', async () => {
      const userMessages = await store.getMessagesByType('user-input');
      expect(userMessages).toHaveLength(2);
      expect(userMessages.every(msg => msg.type === 'user-input')).toBe(true);
    });

    it('should search messages by regex pattern', async () => {
      const matches = await store.searchByRegex('user');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.every(msg => msg.content.includes('user'))).toBe(true);
    });

    it('should search messages by regex with type filter', async () => {
      const matches = await store.searchByRegex('message', undefined, 'system');
      expect(matches).toHaveLength(1);
      expect(matches[0].type).toBe('system');
    });

    it('should search messages by regex with limit', async () => {
      const matches = await store.searchByRegex('user', 1);
      expect(matches).toHaveLength(1);
    });
  });

  describe('message updates', () => {
    it('should update existing message', async () => {
      const original = createTestMessage('1', 'user-input', 'original');
      await store.storeMessage(original);
      
      await store.updateMessage('1', { content: 'updated content' });
      
      const updated = await store.getMessageById('1');
      expect(updated?.content).toBe('updated content');
      expect(updated?.type).toBe('user-input');
    });

    it('should not update non-existent message', async () => {
      await store.updateMessage('non-existent', { content: 'updated' });
      
      const message = await store.getMessageById('non-existent');
      expect(message).toBeNull();
    });
  });

  describe('message clearing', () => {
    it('should clear all messages', async () => {
      const messages = [
        createTestMessage('1', 'user-input'),
        createTestMessage('2', 'system')
      ];
      await store.storeMessages(messages);
      
      await store.clearHistory();
      
      const allMessages = await store.getAllMessages();
      expect(allMessages).toHaveLength(0);
    });
  });

  describe('message history observable', () => {
    it('should emit updated history when messages are stored', async () => {
      const message = createTestMessage('1', 'user-input');
      
      // Get initial state
      const initialHistory = await firstValueFrom(store.messageHistory$);
      expect(initialHistory).toHaveLength(0);
      
      // Store message and check emission
      await store.storeMessage(message);
      const updatedHistory = await firstValueFrom(store.messageHistory$);
      expect(updatedHistory).toHaveLength(1);
      expect(updatedHistory[0]).toEqual(message);
    });

    it('should emit updated history when messages are cleared', async () => {
      const message = createTestMessage('1', 'user-input');
      await store.storeMessage(message);
      
      await store.clearHistory();
      
      const history = await firstValueFrom(store.messageHistory$);
      expect(history).toHaveLength(0);
    });

    it('should emit sorted messages by timestamp', async () => {
      const now = new Date();
      const message1 = { ...createTestMessage('1', 'user-input'), timestamp: new Date(now.getTime() + 1000) };
      const message2 = { ...createTestMessage('2', 'user-input'), timestamp: new Date(now.getTime()) };
      
      await store.storeMessage(message1);
      await store.storeMessage(message2);
      
      const history = await firstValueFrom(store.messageHistory$);
      expect(history[0].id).toBe('2'); // Earlier timestamp should be first
      expect(history[1].id).toBe('1');
    });
  });
});