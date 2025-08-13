import { VectorStore, VectorResult } from '../../../../src/application/interfaces/vector-store.js';

/**
 * Mock VectorStore implementation for testing
 * Tracks all operations for verification
 */
export class MockVectorStore implements VectorStore {
  initializeCalled = false;
  storedVectors = new Map<string, { vector: number[], metadata: Record<string, any> }>();
  searchResults: VectorResult[] = [];
  
  // Operation tracking
  storeVectorCalls: Array<{ id: string, vector: number[], metadata: Record<string, any> }> = [];
  updateVectorCalls: Array<{ id: string, vector: number[], metadata: Record<string, any> }> = [];
  removeVectorCalls: string[] = [];
  searchSimilarCalls: Array<{ queryVector: number[], limit?: number }> = [];
  clearAllCalled = false;

  async initialize(): Promise<void> {
    this.initializeCalled = true;
  }

  async storeVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    this.storeVectorCalls.push({ id, vector: [...vector], metadata: { ...metadata } });
    this.storedVectors.set(id, { vector: [...vector], metadata: { ...metadata } });
  }

  async updateVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    this.updateVectorCalls.push({ id, vector: [...vector], metadata: { ...metadata } });
    if (!this.storedVectors.has(id)) {
      throw new Error(`Vector with id ${id} does not exist`);
    }
    this.storedVectors.set(id, { vector: [...vector], metadata: { ...metadata } });
  }

  async searchSimilar(queryVector: number[], limit?: number): Promise<VectorResult[]> {
    this.searchSimilarCalls.push({ queryVector: [...queryVector], limit });
    return [...this.searchResults]; // Return copy
  }

  async removeVector(id: string): Promise<void> {
    this.removeVectorCalls.push(id);
    this.storedVectors.delete(id);
  }

  async clearAll(): Promise<void> {
    this.clearAllCalled = true;
    this.storedVectors.clear();
  }

  async hasVector(id: string): Promise<boolean> {
    return this.storedVectors.has(id);
  }

  async getVectorCount(): Promise<number> {
    return this.storedVectors.size;
  }

  // Test helper methods
  setSearchResults(results: VectorResult[]): void {
    this.searchResults = results.map(r => ({
      ...r,
      vector: [...r.vector],
      metadata: { ...r.metadata }
    }));
  }

  clearCallHistory(): void {
    this.storeVectorCalls = [];
    this.updateVectorCalls = [];
    this.removeVectorCalls = [];
    this.searchSimilarCalls = [];
    this.clearAllCalled = false;
    this.initializeCalled = false;
  }

  getStoredVector(id: string): { vector: number[], metadata: Record<string, any> } | undefined {
    const stored = this.storedVectors.get(id);
    return stored ? { vector: [...stored.vector], metadata: { ...stored.metadata } } : undefined;
  }
}

export function createTestVectorResult(id: string, vector: number[], metadata: Record<string, any>, distance = 0): VectorResult {
  return {
    id,
    vector: [...vector],
    metadata: { ...metadata },
    distance
  };
}