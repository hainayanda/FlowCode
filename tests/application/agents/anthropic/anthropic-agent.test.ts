import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnthropicAgent } from '../../../../src/application/agents/anthropic/anthropic-agent.js';
import { MockToolbox, createMockAgentInput } from '../base-agent.mocks.js';
import { 
  MockAnthropicClient, 
  createAnthropicConfig, 
  createMockAnthropicStream, 
  mockAnthropicContentChunks, 
  mockAnthropicToolCallChunks,
  mockAnthropicUsageChunk
} from './anthropic-agent.mocks.js';
import { firstValueFrom, toArray } from 'rxjs';

// Mock the Anthropic module
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn()
}));

describe('AnthropicAgent', () => {
  let agent: AnthropicAgent;
  let toolbox: MockToolbox;
  let mockClient: MockAnthropicClient;

  beforeEach(async () => {
    toolbox = new MockToolbox();
    mockClient = new MockAnthropicClient();
    
    // Mock Anthropic constructor to return our mock client
    const Anthropic = vi.mocked(await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementation(() => mockClient as any);
    
    agent = new AnthropicAgent(createAnthropicConfig(), toolbox);
  });

  describe('constructor', () => {
    it('should initialize with Anthropic client', () => {
      // Verify agent was created successfully
      expect(agent).toBeDefined();
      expect(agent.getProvider()).toBe('anthropic');
    });
  });

  describe('processStream', () => {
    it('should stream assistant messages from content chunks', async () => {
      const mockStream = createMockAnthropicStream(mockAnthropicContentChunks);
      mockClient.messages.create.mockResolvedValue(mockStream);

      const input = createMockAgentInput();
      const responses = await firstValueFrom(agent.processStream(input).pipe(toArray()));

      expect(responses).toHaveLength(3); // One for each text delta
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
      const mockStream = createMockAnthropicStream(mockAnthropicToolCallChunks);
      mockClient.messages.create.mockResolvedValue(mockStream);

      const input = createMockAgentInput();
      await firstValueFrom(agent.processStream(input).pipe(toArray()));

      expect(toolbox.executeToolCalled).toBe(true);
      expect(toolbox.lastToolCall).toEqual({
        name: 'test_tool',
        parameters: { param: 'value' }
      });
    });

    it('should handle usage information', async () => {
      const mockStream = createMockAnthropicStream([mockAnthropicUsageChunk]);
      mockClient.messages.create.mockResolvedValue(mockStream);

      const input = createMockAgentInput();
      const responses = await firstValueFrom(agent.processStream(input).pipe(toArray()));

      // Usage info doesn't generate response chunks, just completes
      expect(responses).toHaveLength(0);
    });

    it('should pass correct parameters to Anthropic API', async () => {
      const mockStream = createMockAnthropicStream([]);
      mockClient.messages.create.mockResolvedValue(mockStream);

      const input = createMockAgentInput();
      await firstValueFrom(agent.processStream(input).pipe(toArray()));

      expect(mockClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        temperature: 0.5,
        system: 'You are a helpful assistant',
        messages: [
          { role: 'user', content: 'Hello, world!' }
        ],
        tools: [
          {
            name: 'test-tool',
            description: 'A test tool',
            input_schema: {
              type: 'object',
              properties: { type: 'string' },
              required: []
            }
          }
        ],
        stream: true
      });
    });

    it('should handle API errors', async () => {
      const error = new Error('API Error');
      mockClient.messages.create.mockRejectedValue(error);

      const input = createMockAgentInput();
      
      await expect(
        firstValueFrom(agent.processStream(input).pipe(toArray()))
      ).rejects.toThrow('API Error');
    });
  });

  describe('validateConfig', () => {
    it('should return true for successful API test', async () => {
      mockClient.messages.create.mockResolvedValue({});

      const result = await agent.validateConfig();
      expect(result).toBe(true);
      
      expect(mockClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
    });

    it('should return false for API failure', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Auth error'));

      const result = await agent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false for invalid base config', async () => {
      const invalidConfig = { ...createAnthropicConfig(), apiKey: '' };
      const invalidAgent = new AnthropicAgent(invalidConfig, toolbox);

      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return anthropic provider', () => {
      expect(agent.getProvider()).toBe('anthropic');
    });
  });
});