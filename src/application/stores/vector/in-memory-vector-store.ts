import { VectorStore, VectorResult } from '../../interfaces/vector-store.js';

interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  timestamp: Date;
}

/**
 * In-memory vector store implementation for fast access
 * Uses cosine similarity for vector search
 */
export class InMemoryVectorStore implements VectorStore {
  private vectors: Map<string, VectorEntry> = new Map();
  private initialized = false;

  /**
   * Initialize the vector store (no-op for in-memory)
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  /**
   * Store a vector with associated metadata
   */
  async storeVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    await this.ensureInitialized();
    
    const entry: VectorEntry = {
      id,
      vector: [...vector], // Create a copy
      metadata: { ...metadata }, // Create a copy
      timestamp: new Date()
    };
    
    this.vectors.set(id, entry);
  }

  /**
   * Update existing vector and metadata
   */
  async updateVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.vectors.has(id)) {
      throw new Error(`Vector with id ${id} does not exist`);
    }
    
    const existingEntry = this.vectors.get(id)!;
    const updatedEntry: VectorEntry = {
      id,
      vector: [...vector],
      metadata: { ...metadata },
      timestamp: existingEntry.timestamp // Keep original timestamp
    };
    
    this.vectors.set(id, updatedEntry);
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async searchSimilar(queryVector: number[], limit = 10): Promise<VectorResult[]> {
    await this.ensureInitialized();
    
    const results: VectorResult[] = [];
    
    for (const entry of this.vectors.values()) {
      try {
        const similarity = this.cosineSimilarity(queryVector, entry.vector);
        const distance = 1 - similarity; // Convert similarity to distance
        
        results.push({
          id: entry.id,
          vector: [...entry.vector], // Return a copy
          metadata: { ...entry.metadata }, // Return a copy
          distance
        });
      } catch (error) {
        // Skip vectors with mismatched dimensions
        continue;
      }
    }
    
    // Sort by distance (ascending = most similar first) and limit
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, limit);
  }

  /**
   * Remove vector by ID
   */
  async removeVector(id: string): Promise<void> {
    await this.ensureInitialized();
    this.vectors.delete(id);
  }

  /**
   * Clear all vectors
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    this.vectors.clear();
  }

  /**
   * Check if vector exists by ID
   */
  async hasVector(id: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.vectors.has(id);
  }

  /**
   * Get total number of stored vectors
   */
  async getVectorCount(): Promise<number> {
    await this.ensureInitialized();
    return this.vectors.size;
  }

  /**
   * Get all vector entries (for testing/debugging)
   */
  async getAllVectors(): Promise<VectorResult[]> {
    await this.ensureInitialized();
    
    return Array.from(this.vectors.values()).map(entry => ({
      id: entry.id,
      vector: [...entry.vector],
      metadata: { ...entry.metadata },
      distance: 0 // No meaningful distance for all vectors
    }));
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same dimension');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0; // Handle zero vectors
    }
    
    return dotProduct / (normA * normB);
  }
}