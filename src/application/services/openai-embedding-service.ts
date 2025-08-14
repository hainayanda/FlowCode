import { EmbeddingService } from '../interfaces/embedding-service.js';
import OpenAI from 'openai';

/**
 * OpenAI embedding service implementation using text-embedding-3-small
 */
export class OpenAIEmbeddingService implements EmbeddingService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'text-embedding-3-small') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with minimal text to check if service is working
      await this.generateEmbedding('test');
      return true;
    } catch {
      return false;
    }
  }

  getEmbeddingDimension(): number {
    // text-embedding-3-small produces 1536-dimensional embeddings
    return this.model === 'text-embedding-3-small' ? 1536 : 1536;
  }
}