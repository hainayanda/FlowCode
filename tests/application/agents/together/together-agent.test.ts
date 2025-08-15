import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TogetherAgent } from '../../../../src/application/agents/together/together-agent.js';
import { MockToolbox, createMockAgentInput } from '../base-agent.mocks.js';
import { 
  MockOpenAIClient, 
  createMockStream, 
  mockContentChunks, 
  mockToolCallChunks,
  mockEmptyChunk
} from '../openai/openai-agent.mocks.js';
import { firstValueFrom, toArray } from 'rxjs';

// Mock the OpenAI module
vi.mock('openai', () => ({
  default: vi.fn()
}));

function createTogetherConfig() {
  return {
    model: 'meta-llama/Meta-Llama-3.3-70B-Instruct',
    provider: 'together',
    apiKey: 'test-api-key',
    temperature: 0.7,
    maxTokens: 4096,
    baseUrl: 'https://api.together.xyz/v1'
  };
}

describe('TogetherAgent', () => {
  let agent: TogetherAgent;
  let toolbox: MockToolbox;
  let mockClient: MockOpenAIClient;

  beforeEach(async () => {
    toolbox = new MockToolbox();
    mockClient = new MockOpenAIClient();
    
    // Mock OpenAI constructor to return our mock client
    const OpenAI = vi.mocked(await import('openai')).default;
    OpenAI.mockImplementation(() => mockClient as any);
    
    agent = new TogetherAgent(createTogetherConfig(), toolbox);
  });

  describe('constructor', () => {
    it('should initialize with Together.ai client', async () => {
      const OpenAI = vi.mocked(await import('openai')).default;
      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        baseURL: 'https://api.together.xyz/v1'
      });
    });
  });

  describe('processStream', () => {
    it('should stream assistant messages from content chunks', async () => {
      const mockStream = createMockStream(mockContentChunks);
      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const input = createMockAgentInput();
      const responses = await firstValueFrom(agent.processStream(input).pipe(toArray()));

      expect(responses).toHaveLength(3);
      expect(responses[0].message.content).toBe('Hello');
      expect(responses[1].message.content).toBe('Hello world');
      expect(responses[2].message.content).toBe('Hello world!');
      
      responses.forEach(response => {
        expect(response.message.type).toBe('assistant');
        expect(response.message.id).toMatch(/^msg_\d+_[a-z0-9]{9}$/);
        expect(response.message.timestamp).toBeInstanceOf(Date);
      });
    });

    it('should handle tool calls in stream', async () => {
      const mockStream = createMockStream(mockToolCallChunks);
      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const input = createMockAgentInput();
      await firstValueFrom(agent.processStream(input).pipe(toArray()));

      expect(toolbox.executeToolCalled).toBe(true);
      expect(toolbox.lastToolCall).toEqual({
        name: 'test_tool',
        parameters: { param: 'value' }
      });
    });

    it('should handle empty chunks gracefully', async () => {
      const mockStream = createMockStream([mockEmptyChunk]);
      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const input = createMockAgentInput();
      const responses = await firstValueFrom(agent.processStream(input).pipe(toArray()));

      expect(responses).toHaveLength(0);
    });

    it('should pass correct parameters to Together API', async () => {
      const mockStream = createMockStream([]);
      mockClient.chat.completions.create.mockResolvedValue(mockStream);

      const input = createMockAgentInput();
      await firstValueFrom(agent.processStream(input).pipe(toArray()));

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'meta-llama/Meta-Llama-3.3-70B-Instruct',
        max_tokens: 2048,
        temperature: 0.5,
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello, world!' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'test-tool',
              description: 'A test tool',
              parameters: {
                type: 'object',
                properties: { type: 'string' },
                required: []
              }
            }
          }
        ],
        stream: true
      });
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockClient.chat.completions.create.mockRejectedValue(error);

      const input = createMockAgentInput();
      
      await expect(
        firstValueFrom(agent.processStream(input).pipe(toArray()))
      ).rejects.toThrow('API Error');
    });
  });

  describe('validateConfig', () => {
    it('should return true for successful API test', async () => {
      mockClient.chat.completions.create.mockResolvedValue({});

      const result = await agent.validateConfig();
      expect(result).toBe(true);
      
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'meta-llama/Meta-Llama-3.3-70B-Instruct',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
    });

    it('should return false for API failure', async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error('Auth error'));

      const result = await agent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false for invalid base config', async () => {
      const invalidConfig = { ...createTogetherConfig(), apiKey: '' };
      const invalidAgent = new TogetherAgent(invalidConfig, toolbox);

      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return together provider', () => {
      expect(agent.getProvider()).toBe('together');
    });
  });
});