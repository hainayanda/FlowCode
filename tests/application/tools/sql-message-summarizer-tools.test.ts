import { describe, it, expect, beforeEach } from 'vitest';
import { SqlMessageSummarizerTools } from '../../../src/application/tools/sql-message-summarizer-tools.js';
import { SummarizerAgent, SummaryResult } from '../../../src/application/interfaces/summarizer-agent.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';
import { MessageReader } from '../../../src/application/interfaces/message-store.js';
import { AgentMessage } from '../../../src/application/interfaces/agent.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';
import { ToolCall } from '../../../src/application/interfaces/toolbox.js';

// Mock implementations
class MockMessageReader implements MessageReader {
  getMessageHistoryCallCount = 0;
  searchByRegexCallCount = 0;
  getMessagesByTypeCallCount = 0;
  
  lastRegexPattern = '';
  lastMessageType = '';
  lastLimit = 0;

  private mockMessages: DomainMessage[] = [
    {
      id: 'msg1',
      type: 'user-input',
      content: 'Hello, I need help with authentication',
      timestamp: new Date('2024-01-01T10:00:00Z')
    },
    {
      id: 'msg2',
      type: 'ai-response',
      content: 'I can help you implement authentication using JWT tokens',
      timestamp: new Date('2024-01-01T10:01:00Z'),
      metadata: { workerId: 'test-worker' }
    },
    {
      id: 'msg3',
      type: 'user-input',
      content: 'How do I set up the database for users?',
      timestamp: new Date('2024-01-01T10:02:00Z')
    }
  ];

  async getMessageHistory(limit: number): Promise<DomainMessage[]> {
    this.getMessageHistoryCallCount++;
    this.lastLimit = limit;
    return this.mockMessages.slice(-limit);
  }

  async searchByRegex(pattern: string, limit: number, messageType?: DomainMessage['type']): Promise<DomainMessage[]> {
    this.searchByRegexCallCount++;
    this.lastRegexPattern = pattern;
    this.lastLimit = limit;
    this.lastMessageType = messageType || '';

    let filtered = this.mockMessages;
    if (messageType) {
      filtered = filtered.filter(msg => msg.type === messageType);
    }
    return filtered.filter(msg => new RegExp(pattern).test(msg.content)).slice(0, limit);
  }

  async getMessagesByType(messageType: DomainMessage['type']): Promise<DomainMessage[]> {
    this.getMessagesByTypeCallCount++;
    this.lastMessageType = messageType;
    return this.mockMessages.filter(msg => msg.type === messageType);
  }

  async getMessageById(messageId: string): Promise<DomainMessage | null> {
    return this.mockMessages.find(msg => msg.id === messageId) || null;
  }
}

class MockSummarizerAgent implements SummarizerAgent {
  summarizeCallCount = 0;
  lastMessagesReceived: AgentMessage[] = [];

  async summarizeMessages(messages: AgentMessage[]): Promise<SummaryResult> {
    this.summarizeCallCount++;
    this.lastMessagesReceived = messages;
    
    return {
      summary: `Summary of ${messages.length} messages about authentication`,
      messageCount: messages.length,
      timeSpan: messages.length > 0 ? {
        start: messages[0].timestamp,
        end: messages[messages.length - 1].timestamp
      } : undefined,
      tokenUsage: {
        promptTokens: 150,
        completionTokens: 75,
        totalTokens: 225
      }
    };
  }
}

class MockEmbeddingService implements EmbeddingService {
  async generateEmbedding(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3]);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  getEmbeddingDimension(): number {
    return 3;
  }
}

describe('SqlMessageSummarizerTools', () => {
  let sqlSummarizerTools: SqlMessageSummarizerTools;
  let mockMessageReader: MockMessageReader;
  let mockSummarizerAgent: MockSummarizerAgent;
  let mockEmbeddingService: MockEmbeddingService;

  beforeEach(() => {
    mockMessageReader = new MockMessageReader();
    mockSummarizerAgent = new MockSummarizerAgent();
    mockEmbeddingService = new MockEmbeddingService();
    sqlSummarizerTools = new SqlMessageSummarizerTools(
      mockEmbeddingService,
      mockMessageReader,
      mockSummarizerAgent
    );
  });

  describe('toolbox interface', () => {
    it('should have correct id and description', () => {
      expect(sqlSummarizerTools.id).toBe('sql_message_summarizer_tools');
      expect(sqlSummarizerTools.description).toBe('SQL-based message summarization toolbox for regex-based and filtered message summaries');
    });

    it('should return correct tool definitions', () => {
      const tools = sqlSummarizerTools.getTools();
      expect(tools).toHaveLength(3);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('summarize_all_messages');
      expect(toolNames).toContain('summarize_messages_regex');
      expect(toolNames).toContain('summarize_messages_by_type');
    });

    it('should support all its defined tools', () => {
      expect(sqlSummarizerTools.supportsTool('summarize_all_messages')).toBe(true);
      expect(sqlSummarizerTools.supportsTool('summarize_messages_regex')).toBe(true);
      expect(sqlSummarizerTools.supportsTool('summarize_messages_by_type')).toBe(true);
      expect(sqlSummarizerTools.supportsTool('unknown_tool')).toBe(false);
    });
  });

  describe('summarize_all_messages tool', () => {
    it('should successfully summarize all messages', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_all_messages',
        parameters: { limit: 10 }
      };

      const result = await sqlSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.summary.summary).toContain('authentication');
      expect(result.data.messagesFound).toBe(3);
      expect(result.data.searchType).toBe('sql');
      expect(result.data.query).toBe('all recent messages');
      expect(mockMessageReader.getMessageHistoryCallCount).toBe(1);
      expect(mockSummarizerAgent.summarizeCallCount).toBe(1);
    });

    it('should apply limit parameter', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_all_messages',
        parameters: { limit: 2 }
      };

      await sqlSummarizerTools.executeTool(toolCall);

      expect(mockMessageReader.lastLimit).toBe(2);
    });

    it('should handle empty message history', async () => {
      // Override mock to return empty array
      mockMessageReader.getMessageHistory = async () => [];

      const toolCall: ToolCall = {
        name: 'summarize_all_messages',
        parameters: {}
      };

      const result = await sqlSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No messages found to summarize');
    });
  });

  describe('summarize_messages_regex tool', () => {
    it('should successfully summarize messages matching regex', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_messages_regex',
        parameters: { 
          pattern: 'authentication',
          limit: 10
        }
      };

      const result = await sqlSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.searchType).toBe('sql');
      expect(result.data.query).toBe('regex: authentication');
      expect(mockMessageReader.searchByRegexCallCount).toBe(1);
      expect(mockMessageReader.lastRegexPattern).toBe('authentication');
      expect(mockSummarizerAgent.summarizeCallCount).toBe(1);
    });

    it('should filter by message type when specified', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_messages_regex',
        parameters: { 
          pattern: 'help',
          messageType: 'user-input',
          limit: 5
        }
      };

      await sqlSummarizerTools.executeTool(toolCall);

      expect(mockMessageReader.lastMessageType).toBe('user-input');
      expect(mockMessageReader.lastLimit).toBe(5);
    });

    it('should handle no matching messages', async () => {
      // Override mock to return empty array for specific pattern
      const originalSearch = mockMessageReader.searchByRegex;
      mockMessageReader.searchByRegex = async (pattern: string) => {
        if (pattern === 'nonexistent') return [];
        return originalSearch.call(mockMessageReader, pattern, 10);
      };

      const toolCall: ToolCall = {
        name: 'summarize_messages_regex',
        parameters: { pattern: 'nonexistent' }
      };

      const result = await sqlSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No messages found matching regex pattern');
    });
  });

  describe('summarize_messages_by_type tool', () => {
    it('should successfully summarize messages by type', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_messages_by_type',
        parameters: { 
          messageType: 'user-input',
          limit: 10
        }
      };

      const result = await sqlSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data.searchType).toBe('sql');
      expect(result.data.query).toBe('type: user-input');
      expect(mockMessageReader.getMessagesByTypeCallCount).toBe(1);
      expect(mockMessageReader.lastMessageType).toBe('user-input');
      expect(mockSummarizerAgent.summarizeCallCount).toBe(1);
    });

    it('should handle no messages of specified type', async () => {
      // Override mock to return empty array for specific type
      const originalGetByType = mockMessageReader.getMessagesByType;
      mockMessageReader.getMessagesByType = async (type: DomainMessage['type']) => {
        if (type === 'error') return [];
        return originalGetByType.call(mockMessageReader, type);
      };

      const toolCall: ToolCall = {
        name: 'summarize_messages_by_type',
        parameters: { messageType: 'error' }
      };

      const result = await sqlSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No messages found of type: error');
    });
  });

  describe('message type mapping', () => {
    it('should correctly convert domain message types to agent message types', async () => {
      const toolCall: ToolCall = {
        name: 'summarize_all_messages',
        parameters: {}
      };

      await sqlSummarizerTools.executeTool(toolCall);

      const agentMessages = mockSummarizerAgent.lastMessagesReceived;
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

      const result = await sqlSummarizerTools.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: unknown_tool');
    });
  });
});