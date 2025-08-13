import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVectorStore } from '../../../../src/application/stores/vector/in-memory-vector-store.js';
import { VectorResult } from '../../../../src/application/interfaces/vector-store.js';

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  beforeEach(async () => {
    store = new InMemoryVectorStore();
    await store.initialize();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newStore = new InMemoryVectorStore();
      await expect(newStore.initialize()).resolves.not.toThrow();
    });
  });

  describe('vector storage', () => {
    it('should store and retrieve vectors', async () => {
      const vector = [0.1, 0.2, 0.3];
      const metadata = { type: 'test', content: 'test vector' };

      await store.storeVector('test-1', vector, metadata);
      
      expect(await store.hasVector('test-1')).toBe(true);
      expect(await store.getVectorCount()).toBe(1);
    });

    it('should update existing vectors', async () => {
      const vector1 = [0.1, 0.2, 0.3];
      const vector2 = [0.4, 0.5, 0.6];
      const metadata1 = { type: 'test', content: 'original' };
      const metadata2 = { type: 'test', content: 'updated' };

      await store.storeVector('test-1', vector1, metadata1);
      await store.updateVector('test-1', vector2, metadata2);

      const results = await store.searchSimilar([0.4, 0.5, 0.6], 1);
      expect(results).toHaveLength(1);
      expect(results[0].metadata.content).toBe('updated');
      expect(results[0].vector).toEqual(vector2);
    });

    it('should throw error when updating non-existent vector', async () => {
      const vector = [0.1, 0.2, 0.3];
      const metadata = { type: 'test' };

      await expect(store.updateVector('non-existent', vector, metadata))
        .rejects.toThrow('Vector with id non-existent does not exist');
    });

    it('should remove vectors', async () => {
      const vector = [0.1, 0.2, 0.3];
      const metadata = { type: 'test' };

      await store.storeVector('test-1', vector, metadata);
      expect(await store.hasVector('test-1')).toBe(true);

      await store.removeVector('test-1');
      expect(await store.hasVector('test-1')).toBe(false);
      expect(await store.getVectorCount()).toBe(0);
    });

    it('should clear all vectors', async () => {
      const vector1 = [0.1, 0.2, 0.3];
      const vector2 = [0.4, 0.5, 0.6];
      const metadata = { type: 'test' };

      await store.storeVector('test-1', vector1, metadata);
      await store.storeVector('test-2', vector2, metadata);
      expect(await store.getVectorCount()).toBe(2);

      await store.clearAll();
      expect(await store.getVectorCount()).toBe(0);
    });
  });

  describe('similarity search', () => {
    beforeEach(async () => {
      // Setup test vectors with known similarities
      await store.storeVector('identical', [1, 0, 0], { type: 'test', name: 'identical' });
      await store.storeVector('similar', [0.9, 0.1, 0], { type: 'test', name: 'similar' });
      await store.storeVector('orthogonal', [0, 1, 0], { type: 'test', name: 'orthogonal' });
      await store.storeVector('opposite', [-1, 0, 0], { type: 'test', name: 'opposite' });
    });

    it('should find most similar vectors first', async () => {
      const queryVector = [1, 0, 0]; // Should match 'identical' best
      const results = await store.searchSimilar(queryVector, 4);

      expect(results).toHaveLength(4);
      expect(results[0].metadata.name).toBe('identical');
      expect(results[0].distance).toBeCloseTo(0, 5); // Distance should be 0 for identical vectors
    });

    it('should respect limit parameter', async () => {
      const queryVector = [1, 0, 0];
      const results = await store.searchSimilar(queryVector, 2);

      expect(results).toHaveLength(2);
    });

    it('should return results sorted by similarity', async () => {
      const queryVector = [1, 0, 0];
      const results = await store.searchSimilar(queryVector, 4);

      // Distances should be in ascending order (most similar first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
      }
    });

    it('should handle empty store', async () => {
      await store.clearAll();
      const results = await store.searchSimilar([1, 0, 0], 10);
      expect(results).toHaveLength(0);
    });

    it('should return copies of vectors and metadata', async () => {
      const uniqueVector = [0.5, 0.5, 0.5];
      const originalMetadata = { type: 'test', mutable: 'value' };
      
      await store.storeVector('unique-test', uniqueVector, originalMetadata);
      const results = await store.searchSimilar(uniqueVector, 1);

      // Should find the unique vector we just stored
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('unique-test');
      expect(results[0].metadata.mutable).toBe('value');

      // Modify returned data
      results[0].vector[0] = 999;
      results[0].metadata.mutable = 'modified';

      // Original should be unchanged
      const freshResults = await store.searchSimilar(uniqueVector, 1);
      expect(freshResults[0].vector[0]).toBe(0.5);
      expect(freshResults[0].metadata.mutable).toBe('value');
    });
  });

  describe('cosine similarity', () => {
    it('should handle zero vectors gracefully', async () => {
      await store.storeVector('zero', [0, 0, 0], { type: 'zero' });
      const results = await store.searchSimilar([1, 0, 0], 1);
      
      expect(results).toHaveLength(1);
      expect(results[0].distance).toBe(1); // Distance = 1 - similarity = 1 - 0 = 1
    });

    it('should handle vectors with different magnitudes', async () => {
      await store.storeVector('small', [0.1, 0, 0], { type: 'small' });
      await store.storeVector('large', [10, 0, 0], { type: 'large' });
      
      const results = await store.searchSimilar([1, 0, 0], 2);
      
      // Both should have same similarity (cosine is magnitude-independent)
      expect(results[0].distance).toBeCloseTo(results[1].distance, 5);
    });

    it('should skip vectors with mismatched dimensions gracefully', async () => {
      await store.storeVector('2d', [1, 0], { type: '2d' });
      await store.storeVector('3d', [1, 0, 0], { type: '3d' });
      
      // Should skip the 2D vector and only return the 3D vector
      const results = await store.searchSimilar([1, 0, 0], 2);
      
      expect(results).toHaveLength(1);
      expect(results[0].metadata.type).toBe('3d');
    });
  });
});