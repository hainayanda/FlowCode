import OpenAI from 'openai';
import { BaseEmbeddingAgent, EmbeddingAgentConfig } from '../base-embedding-agent.js';

/**
 * OpenAI embedding agent implementation
 */
export class OpenAIEmbeddingAgent extends BaseEmbeddingAgent {
  private openai: OpenAI;

  constructor(config: EmbeddingAgentConfig) {
    super(config);
    this.openai = new OpenAI({ 
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to generate OpenAI embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      case 'text-embedding-3-small':
        return 1536;
      case 'text-embedding-3-large':
        return 3072;
      case 'text-embedding-ada-002':
        return 1536;
      default:
        return 1536; // Default fallback
    }
  }
}