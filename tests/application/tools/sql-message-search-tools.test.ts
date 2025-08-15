import { describe, it, expect, beforeEach } from 'vitest';
import { SqlMessageSearchTools } from '../../../src/application/tools/sql-message-search-tools.js';
import { MockMessageReader, MockEmbeddingService } from './sql-message-search-tools.mocks.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

describe('SqlMessageSearchTools', () => {
  let sqlMessageSearchTools: SqlMessageSearchTools;
  let mockEmbeddingService: MockEmbeddingService;
  let mockMessageReader: MockMessageReader;

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
    mockMessageReader = new MockMessageReader();

    sqlMessageSearchTools = new SqlMessageSearchTools(
      mockEmbeddingService,
      mockMessageReader
    );

    // Setup default mock responses
    mockMessageReader.mockMessages = sampleMessages;
  });

  describe('Tool Registration', () => {
    it('should have correct toolbox identification', () => {
      expect(sqlMessageSearchTools.id).toBe('sql_message_search_tools');
      expect(sqlMessageSearchTools.description).toBe('SQL-based message history search toolbox for regex and type-based queries');
    });

    it('should register all SQL search tools', () => {
      const tools = sqlMessageSearchTools.getTools();
      const toolNames = tools.map(tool => tool.name);

      expect(toolNames).toContain('search_messages_regex');
      expect(toolNames).toContain('get_message_history');
      expect(toolNames).toContain('get_messages_by_type');
      expect(toolNames).toContain('get_message_by_id');
      expect(toolNames).toHaveLength(4);
    });

    it('should support all registered tools', () => {
      expect(sqlMessageSearchTools.supportsTool('search_messages_regex')).toBe(true);
      expect(sqlMessageSearchTools.supportsTool('get_message_history')).toBe(true);
      expect(sqlMessageSearchTools.supportsTool('get_messages_by_type')).toBe(true);
      expect(sqlMessageSearchTools.supportsTool('get_message_by_id')).toBe(true);
      expect(sqlMessageSearchTools.supportsTool('unknown_tool')).toBe(false);
    });
  });

  describe('SQL Search Tools', () => {
    describe('search_messages_regex', () => {
      it('should search messages using regex pattern', async () => {
        const result = await sqlMessageSearchTools.executeTool({
          name: 'search_messages_regex',
          parameters: { pattern: 'authentication', limit: 10 }
        });

        expect(result.success).toBe(true);
        expect(result.data.searchType).toBe('sql');
        expect(result.data.query).toBe('authentication');
        expect(result.data.messages).toEqual(sampleMessages);
        expect(result.data.totalFound).toBe(3);
        expect(mockMessageReader.lastSearchPattern).toBe('authentication');
        expect(mockMessageReader.lastSearchLimit).toBe(10);
      });

      it('should search with message type filter', async () => {
        const result = await sqlMessageSearchTools.executeTool({
          name: 'search_messages_regex',
          parameters: { pattern: 'auth', messageType: 'user-input', limit: 5 }
        });

        expect(result.success).toBe(true);
        expect(mockMessageReader.lastSearchType).toBe('user-input');
        expect(mockMessageReader.lastSearchLimit).toBe(5);
      });

      it('should use default limit when not specified', async () => {
        await sqlMessageSearchTools.executeTool({
          name: 'search_messages_regex',
          parameters: { pattern: 'test' }
        });

        expect(mockMessageReader.lastSearchLimit).toBe(50);
      });
    });

    describe('get_message_history', () => {
      it('should get recent message history', async () => {
        const result = await sqlMessageSearchTools.executeTool({
          name: 'get_message_history',
          parameters: { limit: 20 }
        });

        expect(result.success).toBe(true);
        expect(result.data.searchType).toBe('sql');
        expect(result.data.query).toBe('recent history');
        expect(result.data.messages).toEqual(sampleMessages);
        expect(mockMessageReader.lastHistoryLimit).toBe(20);
      });

      it('should use default limit when not specified', async () => {
        await sqlMessageSearchTools.executeTool({
          name: 'get_message_history',
          parameters: {}
        });

        expect(mockMessageReader.lastHistoryLimit).toBe(100);
      });
    });

    describe('get_messages_by_type', () => {
      it('should get messages filtered by type', async () => {
        const result = await sqlMessageSearchTools.executeTool({
          name: 'get_messages_by_type',
          parameters: { messageType: 'ai-response' }
        });

        expect(result.success).toBe(true);
        expect(result.data.searchType).toBe('sql');
        expect(result.data.query).toBe('type: ai-response');
        expect(result.data.messages).toEqual([sampleMessages[2]]); // Only ai-response message
        expect(mockMessageReader.lastTypeFilter).toBe('ai-response');
      });
    });

    describe('get_message_by_id', () => {
      it('should get message by ID when found', async () => {
        const result = await sqlMessageSearchTools.executeTool({
          name: 'get_message_by_id',
          parameters: { messageId: 'msg2' }
        });

        expect(result.success).toBe(true);
        expect(result.data.searchType).toBe('sql');
        expect(result.data.query).toBe('id: msg2');
        expect(result.data.messages).toEqual([sampleMessages[1]]);
        expect(mockMessageReader.lastMessageId).toBe('msg2');
      });

      it('should handle message not found', async () => {
        mockMessageReader.mockMessages = [];

        const result = await sqlMessageSearchTools.executeTool({
          name: 'get_message_by_id',
          parameters: { messageId: 'nonexistent' }
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Message with ID 'nonexistent' not found");
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool calls', async () => {
      const result = await sqlMessageSearchTools.executeTool({
        name: 'unknown_tool',
        parameters: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: unknown_tool');
    });

    it('should handle SQL search errors', async () => {
      mockMessageReader.shouldThrowError = true;

      const result = await sqlMessageSearchTools.executeTool({
        name: 'search_messages_regex',
        parameters: { pattern: 'test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });

    it('should handle get message by ID errors', async () => {
      mockMessageReader.shouldThrowError = true;

      const result = await sqlMessageSearchTools.executeTool({
        name: 'get_message_by_id',
        parameters: { messageId: 'test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool execution failed');
    });
  });

  describe('Direct Method Calls', () => {
    it('should search messages by regex directly', async () => {
      const result = await sqlMessageSearchTools.searchMessagesRegex('auth', 15, 'user-input');

      expect(result.searchType).toBe('sql');
      expect(result.query).toBe('auth');
      expect(result.messages).toEqual([sampleMessages[0]]); // Only user message containing 'auth'
      expect(mockMessageReader.lastSearchPattern).toBe('auth');
      expect(mockMessageReader.lastSearchLimit).toBe(15);
      expect(mockMessageReader.lastSearchType).toBe('user-input');
    });

    it('should get message history directly', async () => {
      const result = await sqlMessageSearchTools.getMessageHistory(25);

      expect(result.searchType).toBe('sql');
      expect(result.query).toBe('recent history');
      expect(result.messages).toEqual(sampleMessages);
      expect(mockMessageReader.lastHistoryLimit).toBe(25);
    });

    it('should get messages by type directly', async () => {
      const result = await sqlMessageSearchTools.getMessagesByType('error');

      expect(result.searchType).toBe('sql');
      expect(result.query).toBe('type: error');
      expect(mockMessageReader.lastTypeFilter).toBe('error');
    });

    it('should get message by ID directly', async () => {
      const result = await sqlMessageSearchTools.getMessageById('msg1');

      expect(result.searchType).toBe('sql');
      expect(result.query).toBe('id: msg1');
      expect(result.messages).toEqual([sampleMessages[0]]);
      expect(mockMessageReader.lastMessageId).toBe('msg1');
    });

    it('should handle message not found in direct call', async () => {
      mockMessageReader.mockMessages = [];

      const result = await sqlMessageSearchTools.getMessageById('nonexistent');

      expect(result.searchType).toBe('sql');
      expect(result.totalFound).toBe(0);
      expect(result.messages).toEqual([]);
    });
  });
});