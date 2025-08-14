import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoyageEmbeddingAgent } from '../../../../src/application/embedded-agents/voyage/voyage-embedding-agent.js';
import { EmbeddingAgentConfig } from '../../../../src/application/embedded-agents/base-embedding-agent.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('VoyageEmbeddingAgent', () => {
  let agent: VoyageEmbeddingAgent;
  let mockConfig: EmbeddingAgentConfig;
  let mockFetch: any;

  beforeEach(() => {
    mockConfig = {
      provider: 'voyage',
      model: 'voyage-3-lite',
      enabled: true,
      apiKey: 'test-api-key'
    };

    mockFetch = global.fetch as any;
    agent = new VoyageEmbeddingAgent(mockConfig);
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
          data: [{ embedding: mockEmbedding }]
        })
      });

      const result = await agent.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockFetch).toHaveBeenCalledWith('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'voyage-3-lite',
          input: ['test text'],
          input_type: 'document'
        })
      });
    });

    it('should use custom baseUrl when provided', async () => {
      agent = new VoyageEmbeddingAgent({
        ...mockConfig,
        baseUrl: 'https://custom.api.url'
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [{ embedding: [0.1, 0.2] }]
        })
      });

      await agent.generateEmbedding('test text');

      expect(mockFetch).toHaveBeenCalledWith('https://custom.api.url/v1/embeddings', expect.any(Object));
    });

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(agent.generateEmbedding('test text'))
        .rejects.toThrow('Failed to generate Voyage embedding: Voyage API error: 401 Unauthorized');
    });
  });

  describe('getEmbeddingDimension', () => {
    it('should return correct dimensions for voyage-3-lite', () => {
      const result = agent.getEmbeddingDimension();
      expect(result).toBe(512);
    });

    it('should return correct dimensions for voyage-lite-02-instruct', () => {
      agent = new VoyageEmbeddingAgent({
        ...mockConfig,
        model: 'voyage-lite-02-instruct'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(1024);
    });

    it('should return correct dimensions for voyage-3', () => {
      agent = new VoyageEmbeddingAgent({
        ...mockConfig,
        model: 'voyage-3'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(1024);
    });

    it('should return default dimensions for unknown model', () => {
      agent = new VoyageEmbeddingAgent({
        ...mockConfig,
        model: 'unknown-model'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(512);
    });
  });
});