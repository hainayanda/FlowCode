import { describe, it, expect, beforeEach } from 'vitest';
import { VectorStoreRepository } from '../../../../src/application/stores/vector/vector-store-repository.js';
import { MockVectorStore, createTestVectorResult } from './vector-store-repository.mocks.js';

describe('VectorStoreRepository', () => {
  let repository: VectorStoreRepository;
  let mockInMemoryStore: MockVectorStore;
  let mockPersistentStore: MockVectorStore;

  beforeEach(async () => {
    mockInMemoryStore = new MockVectorStore();
    mockPersistentStore = new MockVectorStore();
    repository = new VectorStoreRepository(mockInMemoryStore, mockPersistentStore);
  });

  describe('initialization', () => {
    it('should initialize both stores', async () => {
      await repository.initialize();
      
      expect(mockInMemoryStore.initializeCalled).toBe(true);
      expect(mockPersistentStore.initializeCalled).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await repository.initialize();
      mockInMemoryStore.clearCallHistory();
      mockPersistentStore.clearCallHistory();
      
      await repository.initialize();
      
      // Should not call initialize again
      expect(mockInMemoryStore.initializeCalled).toBe(false);
      expect(mockPersistentStore.initializeCalled).toBe(false);
    });

    it('should throw error if store initialization fails', async () => {
      const errorStore = new MockVectorStore();
      errorStore.initialize = async () => {
        throw new Error('Initialization failed');
      };
      
      const errorRepo = new VectorStoreRepository(errorStore, mockPersistentStore);
      
      await expect(errorRepo.initialize()).rejects.toThrow('Failed to initialize vector store repository');
    });
  });

  describe('vector storage', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should store vectors in both stores', async () => {
      const vector = [0.1, 0.2, 0.3];
      const metadata = { type: 'test' };
      
      await repository.storeVector('test-1', vector, metadata);
      
      expect(mockInMemoryStore.storeVectorCalls).toHaveLength(1);
      expect(mockPersistentStore.storeVectorCalls).toHaveLength(1);
      
      expect(mockInMemoryStore.storeVectorCalls[0]).toEqual({
        id: 'test-1',
        vector,
        metadata
      });
      expect(mockPersistentStore.storeVectorCalls[0]).toEqual({
        id: 'test-1',
        vector,
        metadata
      });
    });

    it('should update vectors in both stores', async () => {
      const vector = [0.4, 0.5, 0.6];
      const metadata = { type: 'test', updated: true };
      
      // First store a vector in both mocks
      await mockInMemoryStore.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' });
      await mockPersistentStore.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' });
      mockInMemoryStore.clearCallHistory();
      mockPersistentStore.clearCallHistory();
      
      await repository.updateVector('test-1', vector, metadata);
      
      expect(mockInMemoryStore.updateVectorCalls).toHaveLength(1);
      expect(mockPersistentStore.updateVectorCalls).toHaveLength(1);
      
      expect(mockInMemoryStore.updateVectorCalls[0]).toEqual({
        id: 'test-1',
        vector,
        metadata
      });
    });

    it('should remove vectors from both stores', async () => {
      await repository.removeVector('test-1');
      
      expect(mockInMemoryStore.removeVectorCalls).toContain('test-1');
      expect(mockPersistentStore.removeVectorCalls).toContain('test-1');
    });

    it('should clear all vectors from both stores', async () => {
      await repository.clearAll();
      
      expect(mockInMemoryStore.clearAllCalled).toBe(true);
      expect(mockPersistentStore.clearAllCalled).toBe(true);
    });
  });

  describe('vector search', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should search from in-memory store for performance', async () => {
      const queryVector = [0.1, 0.2, 0.3];
      const expectedResults = [
        createTestVectorResult('test-1', [0.1, 0.2, 0.3], { type: 'test' }, 0)
      ];
      
      mockInMemoryStore.setSearchResults(expectedResults);
      
      const results = await repository.searchSimilar(queryVector, 5);
      
      expect(mockInMemoryStore.searchSimilarCalls).toHaveLength(1);
      expect(mockPersistentStore.searchSimilarCalls).toHaveLength(0);
      
      expect(mockInMemoryStore.searchSimilarCalls[0]).toEqual({
        queryVector,
        limit: 5
      });
      
      expect(results).toEqual(expectedResults);
    });

    it('should check vector existence from in-memory store', async () => {
      await mockInMemoryStore.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' });
      
      const exists = await repository.hasVector('test-1');
      expect(exists).toBe(true);
      
      const notExists = await repository.hasVector('test-2');
      expect(notExists).toBe(false);
    });

    it('should get vector count from in-memory store', async () => {
      await mockInMemoryStore.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' });
      await mockInMemoryStore.storeVector('test-2', [0.4, 0.5, 0.6], { type: 'test' });
      
      const count = await repository.getVectorCount();
      expect(count).toBe(2);
    });
  });

  describe('store statistics', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should return synced status when counts match', async () => {
      // Add same vectors to both stores
      await mockInMemoryStore.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' });
      await mockPersistentStore.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' });
      
      const stats = await repository.getStoreStats();
      
      expect(stats).toEqual({
        inMemoryCount: 1,
        persistentCount: 1,
        syncStatus: 'synced'
      });
    });

    it('should return out_of_sync status when counts differ', async () => {
      await mockInMemoryStore.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' });
      // Only in memory, not in persistent
      
      const stats = await repository.getStoreStats();
      
      expect(stats).toEqual({
        inMemoryCount: 1,
        persistentCount: 0,
        syncStatus: 'out_of_sync'
      });
    });

    it('should return unknown status when persistent store fails', async () => {
      mockPersistentStore.getVectorCount = async () => {
        throw new Error('Persistent store error');
      };
      
      await mockInMemoryStore.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' });
      
      const stats = await repository.getStoreStats();
      
      expect(stats).toEqual({
        inMemoryCount: 1,
        persistentCount: 0,
        syncStatus: 'unknown'
      });
    });
  });

  describe('sync operations', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should sync from persistent store', async () => {
      await repository.syncFromPersistent();
      
      expect(mockInMemoryStore.clearAllCalled).toBe(true);
    });

    it('should handle sync errors gracefully', async () => {
      mockInMemoryStore.clearAll = async () => {
        throw new Error('Clear failed');
      };
      
      // Should not throw, just log warning
      await expect(repository.syncFromPersistent()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should handle store operation failures', async () => {
      mockInMemoryStore.storeVector = async () => {
        throw new Error('Storage failed');
      };
      
      await expect(repository.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' }))
        .rejects.toThrow('Storage failed');
    });

    it('should handle partial operation failures', async () => {
      mockPersistentStore.storeVector = async () => {
        throw new Error('Persistent storage failed');
      };
      
      // Should fail because Promise.all fails if any promise fails
      await expect(repository.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' }))
        .rejects.toThrow('Persistent storage failed');
    });

    it('should auto-initialize on operations', async () => {
      const uninitializedRepo = new VectorStoreRepository(mockInMemoryStore, mockPersistentStore);
      
      await uninitializedRepo.storeVector('test-1', [0.1, 0.2, 0.3], { type: 'test' });
      
      expect(mockInMemoryStore.initializeCalled).toBe(true);
      expect(mockPersistentStore.initializeCalled).toBe(true);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await repository.initialize();
    });

    it('should close persistent store connections', async () => {
      let closeCalled = false;
      (mockPersistentStore as any).close = async () => {
        closeCalled = true;
      };
      
      await repository.close();
      
      expect(closeCalled).toBe(true);
    });

    it('should handle close gracefully when store has no close method', async () => {
      await expect(repository.close()).resolves.not.toThrow();
    });
  });
});