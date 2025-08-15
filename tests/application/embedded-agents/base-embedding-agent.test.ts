import { describe, it, expect, beforeEach } from 'vitest';
import { BaseEmbeddingAgent, EmbeddingAgentConfig } from '../../../src/application/embedded-agents/base-embedding-agent.js';

// Concrete implementation for testing the abstract base class
class TestEmbeddingAgent extends BaseEmbeddingAgent {
  private mockEmbedding = [0.1, 0.2, 0.3];
  private mockAvailable = true;
  private mockDimension = 1536;

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text) {
      throw new Error('Text is required');
    }
    return this.mockEmbedding;
  }

  async isAvailable(): Promise<boolean> {
    return this.mockAvailable;
  }

  getEmbeddingDimension(): number {
    return this.mockDimension;
  }

  // Test helpers
  setMockEmbedding(embedding: number[]): void {
    this.mockEmbedding = embedding;
  }

  setMockAvailable(available: boolean): void {
    this.mockAvailable = available;
  }

  setMockDimension(dimension: number): void {
    this.mockDimension = dimension;
  }
}

describe('BaseEmbeddingAgent', () => {
  let agent: TestEmbeddingAgent;
  let mockConfig: EmbeddingAgentConfig;

  beforeEach(() => {
    mockConfig = {
      provider: 'test-provider',
      model: 'test-model',
      enabled: true,
      apiKey: 'test-api-key'
    };
    
    agent = new TestEmbeddingAgent(mockConfig);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(agent.getProvider()).toBe('test-provider');
      expect(agent.getModel()).toBe('test-model');
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', async () => {
      const result = await agent.validateConfig();
      expect(result).toBe(true);
    });

    it('should return false for missing apiKey', async () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };
      const invalidAgent = new TestEmbeddingAgent(invalidConfig);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false for missing model', async () => {
      const invalidConfig = { ...mockConfig, model: '' };
      const invalidAgent = new TestEmbeddingAgent(invalidConfig);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false for missing provider', async () => {
      const invalidConfig = { ...mockConfig, provider: '' };
      const invalidAgent = new TestEmbeddingAgent(invalidConfig);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false for undefined apiKey', async () => {
      const invalidConfig = { ...mockConfig };
      delete (invalidConfig as any).apiKey;
      const invalidAgent = new TestEmbeddingAgent(invalidConfig);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return the provider from config', () => {
      expect(agent.getProvider()).toBe('test-provider');
    });
  });

  describe('getModel', () => {
    it('should return the model from config', () => {
      expect(agent.getModel()).toBe('test-model');
    });
  });

  describe('abstract method implementations', () => {
    it('should call generateEmbedding implementation', async () => {
      const embedding = await agent.generateEmbedding('test text');
      expect(embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle empty text in generateEmbedding', async () => {
      await expect(agent.generateEmbedding('')).rejects.toThrow('Text is required');
    });

    it('should call isAvailable implementation', async () => {
      const available = await agent.isAvailable();
      expect(available).toBe(true);
    });

    it('should call getEmbeddingDimension implementation', () => {
      const dimension = agent.getEmbeddingDimension();
      expect(dimension).toBe(1536);
    });
  });

  describe('test helper methods', () => {
    it('should allow setting mock embedding', async () => {
      const newEmbedding = [0.4, 0.5, 0.6];
      agent.setMockEmbedding(newEmbedding);
      
      const result = await agent.generateEmbedding('test');
      expect(result).toEqual(newEmbedding);
    });

    it('should allow setting mock availability', async () => {
      agent.setMockAvailable(false);
      
      const result = await agent.isAvailable();
      expect(result).toBe(false);
    });

    it('should allow setting mock dimension', () => {
      agent.setMockDimension(768);
      
      const result = agent.getEmbeddingDimension();
      expect(result).toBe(768);
    });
  });
});