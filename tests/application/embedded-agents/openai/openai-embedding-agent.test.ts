import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIEmbeddingAgent } from '../../../../src/application/embedded-agents/openai/openai-embedding-agent.js';
import { EmbeddingAgentConfig } from '../../../../src/application/embedded-agents/base-embedding-agent.js';

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: mockCreate
      }
    }))
  };
});

describe('OpenAIEmbeddingAgent', () => {
  let agent: OpenAIEmbeddingAgent;
  let mockConfig: EmbeddingAgentConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      provider: 'openai',
      model: 'text-embedding-3-small',
      enabled: true,
      apiKey: 'test-api-key'
    };

    agent = new OpenAIEmbeddingAgent(mockConfig);
  });

  describe('generateEmbedding', () => {
    it('should generate embedding successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      const result = await agent.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
        encoding_format: 'float'
      });
    });

    it('should throw error on API failure', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(agent.generateEmbedding('test text'))
        .rejects.toThrow('Failed to generate OpenAI embedding: API Error');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is working', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2] }]
      });

      const result = await agent.isAvailable();

      expect(result).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await agent.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('getEmbeddingDimension', () => {
    it('should return correct dimensions for text-embedding-3-small', () => {
      const result = agent.getEmbeddingDimension();
      expect(result).toBe(1536);
    });

    it('should return correct dimensions for text-embedding-3-large', () => {
      agent = new OpenAIEmbeddingAgent({
        ...mockConfig,
        model: 'text-embedding-3-large'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(3072);
    });

    it('should return correct dimensions for text-embedding-ada-002', () => {
      agent = new OpenAIEmbeddingAgent({
        ...mockConfig,
        model: 'text-embedding-ada-002'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(1536);
    });

    it('should return default dimensions for unknown model', () => {
      agent = new OpenAIEmbeddingAgent({
        ...mockConfig,
        model: 'unknown-model'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(1536);
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', async () => {
      const result = await agent.validateConfig();
      expect(result).toBe(true);
    });

    it('should return false for missing apiKey', async () => {
      agent = new OpenAIEmbeddingAgent({
        ...mockConfig,
        apiKey: ''
      });

      const result = await agent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false for missing model', async () => {
      agent = new OpenAIEmbeddingAgent({
        ...mockConfig,
        model: ''
      });

      const result = await agent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false for missing provider', async () => {
      agent = new OpenAIEmbeddingAgent({
        ...mockConfig,
        provider: ''
      });

      const result = await agent.validateConfig();
      expect(result).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return correct provider', () => {
      const result = agent.getProvider();
      expect(result).toBe('openai');
    });
  });

  describe('getModel', () => {
    it('should return correct model', () => {
      const result = agent.getModel();
      expect(result).toBe('text-embedding-3-small');
    });
  });
});