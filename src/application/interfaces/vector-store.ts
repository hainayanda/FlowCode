/**
 * Vector search result with metadata
 */
export interface VectorResult {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  distance: number;
}

/**
 * Vector storage interface for managing embeddings
 * Abstracts the underlying vector database (SQLite+vss, LanceDB, etc.)
 */
export interface VectorStore {
  /**
   * Initialize the vector store (create tables, indices, etc.)
   */
  initialize(): Promise<void>;
  
  /**
   * Store a vector with associated metadata
   */
  storeVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void>;
  
  /**
   * Update existing vector and metadata
   */
  updateVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void>;
  
  /**
   * Search for similar vectors using cosine similarity
   */
  searchSimilar(queryVector: number[], limit?: number): Promise<VectorResult[]>;
  
  /**
   * Remove vector by ID
   */
  removeVector(id: string): Promise<void>;
  
  /**
   * Clear all vectors
   */
  clearAll(): Promise<void>;
  
  /**
   * Check if vector exists by ID
   */
  hasVector(id: string): Promise<boolean>;
  
  /**
   * Get total number of stored vectors
   */
  getVectorCount(): Promise<number>;
}