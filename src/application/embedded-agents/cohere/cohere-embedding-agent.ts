import { BaseEmbeddingAgent, EmbeddingAgentConfig } from '../base-embedding-agent.js';

/**
 * Cohere embedding agent implementation
 */
export class CohereEmbeddingAgent extends BaseEmbeddingAgent {
  
  constructor(config: EmbeddingAgentConfig) {
    super(config);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.config.baseUrl || 'https://api.cohere.ai'}/v1/embed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          texts: [text],
          input_type: 'search_document'
        }),
      });

      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.embeddings[0];
    } catch (error) {
      throw new Error(`Failed to generate Cohere embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      case 'embed-english-light-v3.0':
        return 384;
      case 'embed-multilingual-light-v3.0':
        return 384;
      case 'embed-english-v3.0':
        return 1024;
      case 'embed-multilingual-v3.0':
        return 1024;
      default:
        return 384; // Default to light model dimensions
    }
  }
}