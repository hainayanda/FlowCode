import { BaseEmbeddingAgent, EmbeddingAgentConfig } from '../base-embedding-agent.js';

/**
 * Voyage AI embedding agent implementation
 */
export class VoyageEmbeddingAgent extends BaseEmbeddingAgent {
  
  constructor(config: EmbeddingAgentConfig) {
    super(config);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.config.baseUrl || 'https://api.voyageai.com'}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          input: [text],
          input_type: 'document'
        }),
      });

      if (!response.ok) {
        throw new Error(`Voyage API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to generate Voyage embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      case 'voyage-lite-02-instruct':
        return 1024;
      case 'voyage-3-lite':
        return 512;
      case 'voyage-3':
        return 1024;
      default:
        return 512; // Default to smallest dimensions
    }
  }
}