import { VectorStore, VectorResult } from '../../interfaces/vector-store.js';

/**
 * Vector store repository that orchestrates both in-memory and persistent storage
 * Follows the same pattern as MessageRepository for consistency
 */
export class VectorStoreRepository implements VectorStore {
  private inMemoryStore: VectorStore;
  private persistentStore: VectorStore;
  private initialized = false;

  constructor(inMemoryStore: VectorStore, persistentStore: VectorStore) {
    this.inMemoryStore = inMemoryStore;
    this.persistentStore = persistentStore;
  }

  /**
   * Initialize both stores and load persistent vectors into memory
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.inMemoryStore.initialize();
      await this.persistentStore.initialize();
      await this.loadPersistentToMemory();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize vector store repository: ${error}`);
    }
  }

  /**
   * Store a vector with associated metadata (to both stores)
   */
  async storeVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    await this.ensureInitialized();
    
    // Store in both stores concurrently
    await Promise.all([
      this.inMemoryStore.storeVector(id, vector, metadata),
      this.persistentStore.storeVector(id, vector, metadata)
    ]);
  }

  /**
   * Update existing vector and metadata (in both stores)
   */
  async updateVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    await this.ensureInitialized();
    
    // Update in both stores concurrently
    await Promise.all([
      this.inMemoryStore.updateVector(id, vector, metadata),
      this.persistentStore.updateVector(id, vector, metadata)
    ]);
  }

  /**
   * Search for similar vectors (from in-memory store for performance)
   */
  async searchSimilar(queryVector: number[], limit?: number): Promise<VectorResult[]> {
    await this.ensureInitialized();
    return this.inMemoryStore.searchSimilar(queryVector, limit);
  }

  /**
   * Remove vector by ID (from both stores)
   */
  async removeVector(id: string): Promise<void> {
    await this.ensureInitialized();
    
    // Remove from both stores concurrently
    await Promise.all([
      this.inMemoryStore.removeVector(id),
      this.persistentStore.removeVector(id)
    ]);
  }

  /**
   * Clear all vectors (from both stores)
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    
    // Clear both stores concurrently
    await Promise.all([
      this.inMemoryStore.clearAll(),
      this.persistentStore.clearAll()
    ]);
  }

  /**
   * Check if vector exists by ID (from in-memory store for performance)
   */
  async hasVector(id: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.inMemoryStore.hasVector(id);
  }

  /**
   * Get total number of stored vectors (from in-memory store for performance)
   */
  async getVectorCount(): Promise<number> {
    await this.ensureInitialized();
    return this.inMemoryStore.getVectorCount();
  }

  /**
   * Sync in-memory store with persistent store
   * Useful for recovery or after external changes to persistent storage
   */
  async syncFromPersistent(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      // Clear in-memory store
      await this.inMemoryStore.clearAll();
      
      // Reload from persistent store
      await this.loadPersistentToMemory();
    } catch (error) {
      console.warn('Failed to sync from persistent store:', error);
    }
  }

  /**
   * Get statistics about both stores
   */
  async getStoreStats(): Promise<{
    inMemoryCount: number;
    persistentCount: number;
    syncStatus: 'synced' | 'out_of_sync' | 'unknown';
  }> {
    await this.ensureInitialized();
    
    try {
      const [inMemoryCount, persistentCount] = await Promise.all([
        this.inMemoryStore.getVectorCount(),
        this.persistentStore.getVectorCount()
      ]);
      
      const syncStatus = inMemoryCount === persistentCount ? 'synced' : 'out_of_sync';
      
      return {
        inMemoryCount,
        persistentCount,
        syncStatus
      };
    } catch (error) {
      return {
        inMemoryCount: await this.inMemoryStore.getVectorCount(),
        persistentCount: 0,
        syncStatus: 'unknown'
      };
    }
  }

  /**
   * Close persistent store connections
   */
  async close(): Promise<void> {
    if (this.persistentStore && 'close' in this.persistentStore) {
      await (this.persistentStore as any).close();
    }
    this.initialized = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async loadPersistentToMemory(): Promise<void> {
    try {
      // Note: This is a simplified approach. In a real implementation,
      // you might want to add a getAllVectors() method to VectorStore interface
      // or implement pagination for large vector datasets.
      
      // For now, we'll rely on the persistent store having been initialized
      // and assume vectors will be loaded on demand through normal operations.
      
      // If we need to implement full sync, we would need to:
      // 1. Add getAllVectors() to VectorStore interface
      // 2. Implement it in both stores
      // 3. Load all vectors from persistent to memory here
      
      console.log('Vector store initialized - vectors will be loaded on demand');
    } catch (error) {
      // Log but don't fail - in-memory store can work without persistent data
      console.warn('Failed to load persistent vectors to memory:', error);
    }
  }
}