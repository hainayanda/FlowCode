import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CohereEmbeddingAgent } from '../../../../src/application/embedded-agents/cohere/cohere-embedding-agent.js';
import { EmbeddingAgentConfig } from '../../../../src/application/embedded-agents/base-embedding-agent.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('CohereEmbeddingAgent', () => {
  let agent: CohereEmbeddingAgent;
  let mockConfig: EmbeddingAgentConfig;
  let mockFetch: any;

  beforeEach(() => {
    mockConfig = {
      provider: 'cohere',
      model: 'embed-english-light-v3.0',
      enabled: true,
      apiKey: 'test-api-key'
    };

    mockFetch = global.fetch as any;
    agent = new CohereEmbeddingAgent(mockConfig);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('generateEmbedding', () => {
    it('should generate embedding successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4];
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          embeddings: [mockEmbedding]
        })
      });

      const result = await agent.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'embed-english-light-v3.0',
          texts: ['test text'],
          input_type: 'search_document'
        })
      });
    });

    it('should use custom baseUrl when provided', async () => {
      agent = new CohereEmbeddingAgent({
        ...mockConfig,
        baseUrl: 'https://custom.api.url'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          embeddings: [[0.1, 0.2]]
        })
      });

      await agent.generateEmbedding('test text');

      expect(mockFetch).toHaveBeenCalledWith('https://custom.api.url/v1/embed', expect.any(Object));
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(agent.generateEmbedding('test text'))
        .rejects.toThrow('Failed to generate Cohere embedding: Cohere API error: 401 Unauthorized');
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(agent.generateEmbedding('test text'))
        .rejects.toThrow('Failed to generate Cohere embedding: Network error');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API is working', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          embeddings: [[0.1, 0.2]]
        })
      });

      const result = await agent.isAvailable();

      expect(result).toBe(true);
    });

    it('should return false when API fails', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      const result = await agent.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('getEmbeddingDimension', () => {
    it('should return correct dimensions for embed-english-light-v3.0', () => {
      const result = agent.getEmbeddingDimension();
      expect(result).toBe(384);
    });

    it('should return correct dimensions for embed-multilingual-light-v3.0', () => {
      agent = new CohereEmbeddingAgent({
        ...mockConfig,
        model: 'embed-multilingual-light-v3.0'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(384);
    });

    it('should return correct dimensions for embed-english-v3.0', () => {
      agent = new CohereEmbeddingAgent({
        ...mockConfig,
        model: 'embed-english-v3.0'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(1024);
    });

    it('should return correct dimensions for embed-multilingual-v3.0', () => {
      agent = new CohereEmbeddingAgent({
        ...mockConfig,
        model: 'embed-multilingual-v3.0'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(1024);
    });

    it('should return default dimensions for unknown model', () => {
      agent = new CohereEmbeddingAgent({
        ...mockConfig,
        model: 'unknown-model'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(384);
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', async () => {
      const result = await agent.validateConfig();
      expect(result).toBe(true);
    });

    it('should return false for missing apiKey', async () => {
      agent = new CohereEmbeddingAgent({
        ...mockConfig,
        apiKey: ''
      });

      const result = await agent.validateConfig();
      expect(result).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return correct provider', () => {
      const result = agent.getProvider();
      expect(result).toBe('cohere');
    });
  });

  describe('getModel', () => {
    it('should return correct model', () => {
      const result = agent.getModel();
      expect(result).toBe('embed-english-light-v3.0');
    });
  });
});