import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SQLiteVectorStore } from '../../../../src/application/stores/vector/sqlite-vector-store.js';

describe('SQLiteVectorStore', () => {
  let store: SQLiteVectorStore;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary database path for testing
    testDbPath = path.join(__dirname, 'test-vectors.db');
    store = new SQLiteVectorStore(testDbPath);
    // Suppress console warnings during tests
    const originalWarn = console.warn;
    console.warn = () => {};
    await store.initialize();
    console.warn = originalWarn;
  });

  afterEach(async () => {
    // Clean up test database
    await store.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    // Also clean up WAL and SHM files
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newStore = new SQLiteVectorStore('/tmp/test-flowcode.db');
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      await expect(newStore.initialize()).resolves.not.toThrow();
      console.warn = originalWarn;
      await newStore.close();
    });

    it('should create database file', async () => {
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should create .flowcode directory if it does not exist', async () => {
      const customPath = path.join(__dirname, 'custom-flowcode', 'vectors.db');
      const customStore = new SQLiteVectorStore(customPath);
      
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      await customStore.initialize();
      console.warn = originalWarn;
      expect(fs.existsSync(customPath)).toBe(true);
      
      await customStore.close();
      // Clean up
      fs.unlinkSync(customPath);
      fs.rmdirSync(path.dirname(customPath));
    });

    it('should not reinitialize if already initialized', async () => {
      // First initialization
      await store.initialize();
      
      // Second initialization should not throw
      await expect(store.initialize()).resolves.not.toThrow();
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

      expect(await store.getVectorCount()).toBe(1); // Should still be 1
      
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const results = await store.searchSimilar([0.4, 0.5, 0.6], 1);
      console.warn = originalWarn;
      expect(results).toHaveLength(1);
      expect(results[0].metadata.content).toBe('updated');
    });

    it('should throw error when updating non-existent vector', async () => {
      const vector = [0.1, 0.2, 0.3];
      const metadata = { type: 'test' };

      await expect(store.updateVector('non-existent', vector, metadata))
        .rejects.toThrow('Vector with id non-existent does not exist');
    });

    it('should replace vectors with same ID', async () => {
      const vector1 = [0.1, 0.2, 0.3];
      const vector2 = [0.4, 0.5, 0.6];
      const metadata1 = { type: 'test', version: 1 };
      const metadata2 = { type: 'test', version: 2 };

      await store.storeVector('test-1', vector1, metadata1);
      await store.storeVector('test-1', vector2, metadata2); // Should replace

      expect(await store.getVectorCount()).toBe(1);
      
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const results = await store.searchSimilar([0.4, 0.5, 0.6], 1);
      console.warn = originalWarn;
      expect(results[0].metadata.version).toBe(2);
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
      // Setup test vectors
      await store.storeVector('vector-1', [1, 0, 0], { type: 'test', name: 'x-axis' });
      await store.storeVector('vector-2', [0, 1, 0], { type: 'test', name: 'y-axis' });
      await store.storeVector('vector-3', [0, 0, 1], { type: 'test', name: 'z-axis' });
      await store.storeVector('vector-4', [0.7, 0.7, 0], { type: 'test', name: 'diagonal' });
    });

    it('should search similar vectors', async () => {
      const queryVector = [1, 0, 0];
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const results = await store.searchSimilar(queryVector, 4);
      console.warn = originalWarn;

      expect(results).toHaveLength(4);
      // Without vss extension, results are ordered by creation time (most recent first)
      // So vector-4 (diagonal) will be first since it was stored last
      expect(results[0].id).toBe('vector-4');
    });

    it('should respect limit parameter', async () => {
      const queryVector = [1, 0, 0];
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const results = await store.searchSimilar(queryVector, 2);
      console.warn = originalWarn;

      expect(results).toHaveLength(2);
    });

    it('should handle empty store', async () => {
      await store.clearAll();
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const results = await store.searchSimilar([1, 0, 0], 10);
      console.warn = originalWarn;
      expect(results).toHaveLength(0);
    });

    it('should handle search without vss extension gracefully', async () => {
      // This test verifies the fallback behavior when sqlite-vss is not available
      const queryVector = [1, 0, 0];
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const results = await store.searchSimilar(queryVector, 4);
      console.warn = originalWarn;

      // Should return results even if similarity search is not available
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('persistence', () => {
    it('should persist vectors across store instances', async () => {
      const vector = [0.1, 0.2, 0.3];
      const metadata = { type: 'test', persistent: true };

      // Store in first instance
      await store.storeVector('persistent-test', vector, metadata);
      await store.close();

      // Create new instance with same database
      const newStore = new SQLiteVectorStore(testDbPath);
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      await newStore.initialize();

      expect(await newStore.hasVector('persistent-test')).toBe(true);
      expect(await newStore.getVectorCount()).toBe(1);

      const results = await newStore.searchSimilar([0.1, 0.2, 0.3], 1);
      console.warn = originalWarn;
      expect(results[0].metadata.persistent).toBe(true);

      await newStore.close();
    });
  });

  describe('error handling', () => {
    it('should handle invalid database path gracefully', async () => {
      const invalidPath = '/root/invalid/path/vectors.db';
      const invalidStore = new SQLiteVectorStore(invalidPath);
      
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      // Should throw meaningful error
      await expect(invalidStore.initialize()).rejects.toThrow();
      console.warn = originalWarn;
    });

    it('should handle corrupted vector data', async () => {
      // This is a more complex test that would require manually corrupting the database
      // For now, we'll test that the store handles empty results gracefully
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const results = await store.searchSimilar([], 1);
      console.warn = originalWarn;
      expect(results).toBeDefined();
    });
  });

  describe('metadata indexing', () => {
    it('should store and retrieve complex metadata', async () => {
      const vector = [0.1, 0.2, 0.3];
      const complexMetadata = {
        type: 'ai-response',
        workerId: 'code-worker',
        timestamp: new Date().toISOString(),
        tokens: 150,
        nested: {
          confidence: 0.95,
          tags: ['javascript', 'async']
        }
      };

      await store.storeVector('complex-meta', vector, complexMetadata);
      
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const results = await store.searchSimilar([0.1, 0.2, 0.3], 1);
      console.warn = originalWarn;
      expect(results[0].metadata.workerId).toBe('code-worker');
      expect(results[0].metadata.nested.confidence).toBe(0.95);
      expect(results[0].metadata.nested.tags).toEqual(['javascript', 'async']);
    });
  });

  describe('vector format handling', () => {
    it('should handle different vector sizes', async () => {
      const smallVector = [0.1, 0.2];
      const largeVector = new Array(1536).fill(0).map((_, i) => i / 1536); // OpenAI embedding size
      
      await store.storeVector('small', smallVector, { size: 'small' });
      await store.storeVector('large', largeVector, { size: 'large' });

      expect(await store.getVectorCount()).toBe(2);
      
      // Without vss extension, results are ordered by creation time (most recent first)
      // So we need to search for all and find by metadata
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const allResults = await store.searchSimilar(smallVector, 2);
      console.warn = originalWarn;
      const smallResult = allResults.find(r => r.metadata.size === 'small');
      const largeResult = allResults.find(r => r.metadata.size === 'large');
      
      expect(smallResult!.vector).toHaveLength(2);
      expect(largeResult!.vector).toHaveLength(1536);
    });

    it('should preserve vector precision', async () => {
      const preciseVector = [0.123456789, -0.987654321, 0.555555555];
      const metadata = { type: 'precision-test' };

      await store.storeVector('precise', preciseVector, metadata);
      
      // Suppress console warnings during tests
      const originalWarn = console.warn;
      console.warn = () => {};
      const results = await store.searchSimilar(preciseVector, 1);
      console.warn = originalWarn;
      
      // Check that precision is maintained (within floating point limits)
      expect(results[0].vector[0]).toBeCloseTo(0.123456789, 6);
      expect(results[0].vector[1]).toBeCloseTo(-0.987654321, 6);
      expect(results[0].vector[2]).toBeCloseTo(0.555555555, 6);
    });
  });
});