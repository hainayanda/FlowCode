import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VectorRepository } from '../../../../src/application/stores/vectors/vector-repository';
import { MockVectorStore } from './vector-store.mocks';
import { VectorSearchResult } from '../../../../src/application/models/sqlite-message';

describe('VectorRepository', () => {
    let repository: VectorRepository;
    let mockCachedStore: MockVectorStore;
    let mockPersistentStore: MockVectorStore;

    beforeEach(() => {
        mockCachedStore = new MockVectorStore();
        mockPersistentStore = new MockVectorStore();
        repository = new VectorRepository(mockCachedStore, mockPersistentStore);
    });

    afterEach(() => {
        mockCachedStore.clear();
        mockPersistentStore.clear();
    });

    describe('constructor', () => {
        it('should create repository with cached and persistent stores', () => {
            expect(repository).toBeDefined();
            expect(repository).toBeInstanceOf(VectorRepository);
        });
    });

    describe('storeVector', () => {
        it('should store vector in both cached and persistent stores', async () => {
            const vector = [0.1, 0.2, 0.3, 0.4];
            const messageId = 'test-message-1';

            await repository.storeVector(vector, messageId);

            // Verify both stores received the vector
            const cachedCalls = mockCachedStore.getStoreCalls();
            const persistentCalls = mockPersistentStore.getStoreCalls();

            expect(cachedCalls).toHaveLength(1);
            expect(persistentCalls).toHaveLength(1);

            expect(cachedCalls[0]).toEqual({ vector, messageId });
            expect(persistentCalls[0]).toEqual({ vector, messageId });
        });

        it('should store vectors in parallel to both stores', async () => {
            const vector = [0.5, 0.6, 0.7];
            const messageId = 'parallel-test';

            // Add delays to verify parallel execution
            mockCachedStore.setStoreDelay(50);
            mockPersistentStore.setStoreDelay(50);

            const startTime = Date.now();
            await repository.storeVector(vector, messageId);
            const endTime = Date.now();

            // Should take around 50ms (parallel) not 100ms (sequential)
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(80); // Allow some margin for test execution
        });

        it('should handle when cached store fails but persistent succeeds', async () => {
            const vector = [0.1, 0.2, 0.3];
            const messageId = 'cached-fail-test';

            mockCachedStore.setShouldThrowOnStore(true);

            await expect(
                repository.storeVector(vector, messageId)
            ).rejects.toThrow('Mock store error');

            // Verify persistent store was still called (Promise.all behavior)
            const persistentCalls = mockPersistentStore.getStoreCalls();
            expect(persistentCalls).toHaveLength(1);
        });

        it('should handle when persistent store fails but cached succeeds', async () => {
            const vector = [0.1, 0.2, 0.3];
            const messageId = 'persistent-fail-test';

            mockPersistentStore.setShouldThrowOnStore(true);

            await expect(
                repository.storeVector(vector, messageId)
            ).rejects.toThrow('Mock store error');

            // Verify cached store was still called (Promise.all behavior)
            const cachedCalls = mockCachedStore.getStoreCalls();
            expect(cachedCalls).toHaveLength(1);
        });

        it('should handle when both stores fail', async () => {
            const vector = [0.1, 0.2, 0.3];
            const messageId = 'both-fail-test';

            mockCachedStore.setShouldThrowOnStore(true);
            mockPersistentStore.setShouldThrowOnStore(true);

            await expect(
                repository.storeVector(vector, messageId)
            ).rejects.toThrow('Mock store error');
        });

        it('should handle empty vectors', async () => {
            const emptyVector: number[] = [];
            const messageId = 'empty-vector-test';

            await repository.storeVector(emptyVector, messageId);

            const cachedCalls = mockCachedStore.getStoreCalls();
            const persistentCalls = mockPersistentStore.getStoreCalls();

            expect(cachedCalls).toHaveLength(1);
            expect(persistentCalls).toHaveLength(1);
            expect(cachedCalls[0].vector).toEqual([]);
            expect(persistentCalls[0].vector).toEqual([]);
        });

        it('should handle large vectors', async () => {
            const largeVector = Array(1536)
                .fill(0)
                .map((_, i) => i / 1536);
            const messageId = 'large-vector-test';

            await repository.storeVector(largeVector, messageId);

            const cachedCalls = mockCachedStore.getStoreCalls();
            const persistentCalls = mockPersistentStore.getStoreCalls();

            expect(cachedCalls).toHaveLength(1);
            expect(persistentCalls).toHaveLength(1);
            expect(cachedCalls[0].vector).toHaveLength(1536);
            expect(persistentCalls[0].vector).toHaveLength(1536);
        });
    });

    describe('searchSimilar', () => {
        beforeEach(async () => {
            // Set up test data in both stores
            const testVectors = [
                { vector: [1.0, 0.0, 0.0], messageId: 'msg-1' },
                { vector: [0.0, 1.0, 0.0], messageId: 'msg-2' },
                { vector: [0.707, 0.707, 0.0], messageId: 'msg-3' },
            ];

            // Store some vectors only in cached store
            const cachedVectors = new Map([
                ['msg-1', { vector: [1.0, 0.0, 0.0], messageId: 'msg-1' }],
                ['msg-3', { vector: [0.707, 0.707, 0.0], messageId: 'msg-3' }],
            ]);
            mockCachedStore.setVectors(cachedVectors);

            // Store some vectors only in persistent store
            const persistentVectors = new Map([
                ['msg-2', { vector: [0.0, 1.0, 0.0], messageId: 'msg-2' }],
                ['msg-4', { vector: [0.9, 0.1, 0.0], messageId: 'msg-4' }],
            ]);
            mockPersistentStore.setVectors(persistentVectors);
        });

        it('should search both stores in parallel', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const limit = 5;

            // Add delays to verify parallel execution
            mockCachedStore.setSearchDelay(50);
            mockPersistentStore.setSearchDelay(50);

            const startTime = Date.now();
            await repository.searchSimilar(queryVector, limit);
            const endTime = Date.now();

            // Should take around 50ms (parallel) not 100ms (sequential)
            const duration = endTime - startTime;
            expect(duration).toBeLessThan(80); // Allow some margin for test execution

            // Verify both stores were called
            const cachedCalls = mockCachedStore.getSearchCalls();
            const persistentCalls = mockPersistentStore.getSearchCalls();

            expect(cachedCalls).toHaveLength(1);
            expect(persistentCalls).toHaveLength(1);
            expect(cachedCalls[0]).toEqual({ vector: queryVector, limit });
            expect(persistentCalls[0]).toEqual({ vector: queryVector, limit });
        });

        it('should combine results from both stores', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 10);

            // Should get results from both stores
            expect(results).toHaveLength(4);

            const messageIds = results.map((r) => r.messageId);
            expect(messageIds).toContain('msg-1'); // From cached
            expect(messageIds).toContain('msg-2'); // From persistent
            expect(messageIds).toContain('msg-3'); // From cached
            expect(messageIds).toContain('msg-4'); // From persistent
        });

        it('should handle duplicates with cached store taking precedence', async () => {
            // Add same message ID to both stores with different vectors
            const cachedVectors = new Map([
                [
                    'msg-duplicate',
                    { vector: [1.0, 0.0, 0.0], messageId: 'msg-duplicate' },
                ],
            ]);
            const persistentVectors = new Map([
                [
                    'msg-duplicate',
                    { vector: [0.0, 1.0, 0.0], messageId: 'msg-duplicate' },
                ],
            ]);

            mockCachedStore.setVectors(cachedVectors);
            mockPersistentStore.setVectors(persistentVectors);

            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 10);

            // Should only have one result for msg-duplicate
            const duplicateResults = results.filter(
                (r) => r.messageId === 'msg-duplicate'
            );
            expect(duplicateResults).toHaveLength(1);

            // Should be from cached store (higher similarity with query vector [1,0,0])
            expect(duplicateResults[0].vector).toEqual([1.0, 0.0, 0.0]);
        });

        it('should sort results by similarity descending', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 10);

            // Verify results are sorted by similarity
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].similarity).toBeGreaterThanOrEqual(
                    results[i].similarity
                );
            }
        });

        it('should respect limit parameter', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 2);

            expect(results).toHaveLength(2);
        });

        it('should use default limit of 10 when not specified', async () => {
            const queryVector = [1.0, 0.0, 0.0];

            await repository.searchSimilar(queryVector);

            const cachedCalls = mockCachedStore.getSearchCalls();
            const persistentCalls = mockPersistentStore.getSearchCalls();

            expect(cachedCalls[0].limit).toBe(10);
            expect(persistentCalls[0].limit).toBe(10);
        });

        it('should handle empty results from both stores', async () => {
            mockCachedStore.clear();
            mockPersistentStore.clear();

            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 10);

            expect(results).toHaveLength(0);
        });

        it('should handle when cached store has results but persistent is empty', async () => {
            mockPersistentStore.clear();

            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 10);

            expect(results).toHaveLength(2); // Only cached results
            const messageIds = results.map((r) => r.messageId);
            expect(messageIds).toContain('msg-1');
            expect(messageIds).toContain('msg-3');
        });

        it('should handle when persistent store has results but cached is empty', async () => {
            mockCachedStore.clear();

            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 10);

            expect(results).toHaveLength(2); // Only persistent results
            const messageIds = results.map((r) => r.messageId);
            expect(messageIds).toContain('msg-2');
            expect(messageIds).toContain('msg-4');
        });

        it('should handle when cached store search fails', async () => {
            mockCachedStore.setShouldThrowOnSearch(true);

            const queryVector = [1.0, 0.0, 0.0];

            await expect(
                repository.searchSimilar(queryVector, 10)
            ).rejects.toThrow('Mock search error');
        });

        it('should handle when persistent store search fails', async () => {
            mockPersistentStore.setShouldThrowOnSearch(true);

            const queryVector = [1.0, 0.0, 0.0];

            await expect(
                repository.searchSimilar(queryVector, 10)
            ).rejects.toThrow('Mock search error');
        });

        it('should handle when both stores search fails', async () => {
            mockCachedStore.setShouldThrowOnSearch(true);
            mockPersistentStore.setShouldThrowOnSearch(true);

            const queryVector = [1.0, 0.0, 0.0];

            await expect(
                repository.searchSimilar(queryVector, 10)
            ).rejects.toThrow('Mock search error');
        });

        it('should preserve all properties of search results', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 10);

            for (const result of results) {
                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('messageId');
                expect(result).toHaveProperty('vector');
                expect(result).toHaveProperty('similarity');
                expect(typeof result.similarity).toBe('number');
                expect(result.similarity).toBeGreaterThanOrEqual(0);
                expect(result.similarity).toBeLessThanOrEqual(1);
            }
        });

        it('should handle zero vectors', async () => {
            // Clear stores first to isolate this test
            mockCachedStore.clear();
            mockPersistentStore.clear();

            const zeroVector = [0.0, 0.0, 0.0];

            // Add zero vector to stores
            const zeroVectors = new Map([
                [
                    'zero-msg',
                    { vector: [0.0, 0.0, 0.0], messageId: 'zero-msg' },
                ],
            ]);
            mockCachedStore.setVectors(zeroVectors);

            const results = await repository.searchSimilar(zeroVector, 10);

            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe('zero-msg');
        });

        it('should handle large result sets efficiently', async () => {
            // Create large datasets in both stores
            const cachedVectors = new Map();
            const persistentVectors = new Map();

            for (let i = 0; i < 50; i++) {
                cachedVectors.set(`cached-${i}`, {
                    vector: [Math.random(), Math.random(), Math.random()],
                    messageId: `cached-${i}`,
                });
                persistentVectors.set(`persistent-${i}`, {
                    vector: [Math.random(), Math.random(), Math.random()],
                    messageId: `persistent-${i}`,
                });
            }

            mockCachedStore.setVectors(cachedVectors);
            mockPersistentStore.setVectors(persistentVectors);

            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 20);

            expect(results).toHaveLength(20);

            // Verify sorting is maintained
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].similarity).toBeGreaterThanOrEqual(
                    results[i].similarity
                );
            }
        });
    });

    describe('edge cases', () => {
        it('should handle negative vector components', async () => {
            const negativeVector = [-0.5, -0.5, 0.707];
            const messageId = 'negative-test';

            await repository.storeVector(negativeVector, messageId);

            const results = await repository.searchSimilar(negativeVector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe(messageId);
        });

        it('should handle single dimension vectors', async () => {
            const singleDimVector = [1.0];
            const messageId = 'single-dim-test';

            await repository.storeVector(singleDimVector, messageId);

            const results = await repository.searchSimilar(singleDimVector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe(messageId);
        });

        it('should handle very large vectors', async () => {
            const largeVector = Array(4096)
                .fill(0)
                .map((_, i) => Math.sin(i / 100));
            const messageId = 'very-large-test';

            await repository.storeVector(largeVector, messageId);

            const results = await repository.searchSimilar(largeVector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe(messageId);
        });

        it('should handle limit larger than available results', async () => {
            mockCachedStore.clear();
            mockPersistentStore.clear();

            // Add only 2 vectors total
            const vectors = new Map([
                ['msg-1', { vector: [1.0, 0.0, 0.0], messageId: 'msg-1' }],
            ]);
            mockCachedStore.setVectors(vectors);

            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 100);

            expect(results).toHaveLength(1); // Only returns available results
        });

        it('should handle limit of 0', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const results = await repository.searchSimilar(queryVector, 0);

            expect(results).toHaveLength(0);
        });
    });
});
