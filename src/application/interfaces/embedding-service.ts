/**
 * Service interface for generating text embeddings
 * Abstracts the embedding provider (OpenAI, local models, etc.)
 */
export interface EmbeddingService {
  /**
   * Generate vector embedding for given text
   */
  generateEmbedding(text: string): Promise<number[]>;
  
  /**
   * Check if embedding service is available and configured
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get the dimension size of embeddings this service produces
   */
  getEmbeddingDimension(): number;
}