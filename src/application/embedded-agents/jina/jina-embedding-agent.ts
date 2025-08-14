import { BaseEmbeddingAgent, EmbeddingAgentConfig } from '../base-embedding-agent.js';

/**
 * Jina AI embedding agent implementation
 */
export class JinaEmbeddingAgent extends BaseEmbeddingAgent {
  
  constructor(config: EmbeddingAgentConfig) {
    super(config);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.config.baseUrl || 'https://api.jina.ai'}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          input: [text],
          encoding_format: 'float'
        }),
      });

      if (!response.ok) {
        throw new Error(`Jina API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to generate Jina embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.generateEmbedding('test');
      return true;
    } catch {
      return false;
    }
  }

  getEmbeddingDimension(): number {
    switch (this.config.model) {
      case 'jina-embeddings-v3':
        return 1024;
      case 'jina-clip-v2':
        return 768;
      default:
        return 768; // Default to smaller dimensions
    }
  }
}