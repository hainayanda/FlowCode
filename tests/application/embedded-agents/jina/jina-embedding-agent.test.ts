import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JinaEmbeddingAgent } from '../../../../src/application/embedded-agents/jina/jina-embedding-agent.js';
import { EmbeddingAgentConfig } from '../../../../src/application/embedded-agents/base-embedding-agent.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('JinaEmbeddingAgent', () => {
  let agent: JinaEmbeddingAgent;
  let mockConfig: EmbeddingAgentConfig;
  let mockFetch: any;

  beforeEach(() => {
    mockConfig = {
      provider: 'jina',
      model: 'jina-clip-v2',
      enabled: true,
      apiKey: 'test-api-key'
    };

    mockFetch = global.fetch as any;
    agent = new JinaEmbeddingAgent(mockConfig);
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
      expect(mockFetch).toHaveBeenCalledWith('https://api.jina.ai/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'jina-clip-v2',
          input: ['test text'],
          encoding_format: 'float'
        })
      });
    });

    it('should use custom baseUrl when provided', async () => {
      agent = new JinaEmbeddingAgent({
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
        .rejects.toThrow('Failed to generate Jina embedding: Jina API error: 401 Unauthorized');
    });
  });

  describe('getEmbeddingDimension', () => {
    it('should return correct dimensions for jina-clip-v2', () => {
      const result = agent.getEmbeddingDimension();
      expect(result).toBe(768);
    });

    it('should return correct dimensions for jina-embeddings-v3', () => {
      agent = new JinaEmbeddingAgent({
        ...mockConfig,
        model: 'jina-embeddings-v3'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(1024);
    });

    it('should return default dimensions for unknown model', () => {
      agent = new JinaEmbeddingAgent({
        ...mockConfig,
        model: 'unknown-model'
      });

      const result = agent.getEmbeddingDimension();
      expect(result).toBe(768);
    });
  });
});