import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CachedVectorStore } from '../../../../src/application/stores/vectors/cached-vector-store';
import { MockSessionManager } from '../messages/session-manager.mocks';

describe('CachedVectorStore', () => {
    let store: CachedVectorStore;
    let mockSessionManager: MockSessionManager;

    beforeEach(() => {
        mockSessionManager = new MockSessionManager(':memory:');
        store = new CachedVectorStore(mockSessionManager);
    });

    afterEach(async () => {
        await store.close();
    });

    describe('initialization', () => {
        it('should initialize with empty vector array', async () => {
            const results = await store.searchSimilar([1, 0, 0], 10);
            expect(results).toEqual([]);
        });

        it('should initialize session on first use', async () => {
            const vector = [0.1, 0.2, 0.3, 0.4];
            const messageId = 'test-message-1';

            await store.storeVector(vector, messageId);
            const results = await store.searchSimilar(vector, 1);

            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe(messageId);
            expect(results[0].similarity).toBeCloseTo(1.0, 5); // Exact match
        });
    });

    describe('storeVector', () => {
        it('should store a vector embedding', async () => {
            const vector = [0.1, 0.2, 0.3, 0.4, 0.5];
            const messageId = 'message-1';

            await store.storeVector(vector, messageId);

            // Verify by searching for similar vectors
            const results = await store.searchSimilar(vector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe(messageId);
            expect(results[0].vector).toEqual(vector);
            expect(results[0].similarity).toBeCloseTo(1.0, 5); // Should be exact match
        });

        it('should replace vector with same message ID', async () => {
            const originalVector = [0.1, 0.2, 0.3, 0.4];
            const updatedVector = [0.5, 0.6, 0.7, 0.8];
            const messageId = 'replace-test';

            await store.storeVector(originalVector, messageId);
            await store.storeVector(updatedVector, messageId);

            // Should only find the updated vector
            const results = await store.searchSimilar(updatedVector, 5);
            const matchingResults = results.filter(
                (r) => r.messageId === messageId
            );

            expect(matchingResults).toHaveLength(1);
            expect(matchingResults[0].vector).toEqual(updatedVector);
            expect(matchingResults[0].similarity).toBeCloseTo(1.0, 5);
        });

        it('should handle empty vectors', async () => {
            const emptyVector: number[] = [];

            await expect(
                store.storeVector(emptyVector, 'empty-test')
            ).rejects.toThrow('Vector cannot be empty');
        });

        it('should handle large vectors', async () => {
            const largeVector = Array(1536)
                .fill(0)
                .map((_, i) => i / 1536);
            const messageId = 'large-vector-test';

            await store.storeVector(largeVector, messageId);

            const results = await store.searchSimilar(largeVector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe(messageId);
            expect(results[0].vector).toHaveLength(1536);
            expect(results[0].similarity).toBeCloseTo(1.0, 5);
        });

        it('should maintain chronological order', async () => {
            const vectors = [
                { vector: [1.0, 0.0, 0.0], messageId: 'msg-1' },
                { vector: [0.0, 1.0, 0.0], messageId: 'msg-2' },
                { vector: [0.0, 0.0, 1.0], messageId: 'msg-3' },
            ];

            // Store vectors with small delays to ensure different timestamps
            for (const { vector, messageId } of vectors) {
                await store.storeVector(vector, messageId);
                await new Promise((resolve) => setTimeout(resolve, 1));
            }

            // Search for vectors - they should be returned in similarity order, not storage order
            const queryVector = [1.0, 0.0, 0.0];
            const results = await store.searchSimilar(queryVector, 3);

            expect(results).toHaveLength(3);
            expect(results[0].messageId).toBe('msg-1'); // Exact match should be first
            expect(results[0].similarity).toBeCloseTo(1.0, 5);
        });
    });

    describe('searchSimilar', () => {
        beforeEach(async () => {
            // Store test vectors with known relationships
            const vectors = [
                { vector: [1.0, 0.0, 0.0], messageId: 'msg-1' }, // Basis vector 1
                { vector: [0.0, 1.0, 0.0], messageId: 'msg-2' }, // Basis vector 2 (orthogonal)
                { vector: [0.707, 0.707, 0.0], messageId: 'msg-3' }, // 45-degree angle
                { vector: [0.9, 0.1, 0.0], messageId: 'msg-4' }, // Close to vector 1
                { vector: [0.1, 0.9, 0.0], messageId: 'msg-5' }, // Close to vector 2
            ];

            for (const { vector, messageId } of vectors) {
                await store.storeVector(vector, messageId);
            }
        });

        it('should find exact matches with highest similarity', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const results = await store.searchSimilar(queryVector, 5);

            expect(results).toHaveLength(5);

            // First result should be exact match
            expect(results[0].messageId).toBe('msg-1');
            expect(results[0].similarity).toBeCloseTo(1.0, 5);
        });

        it('should return results in descending similarity order', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const results = await store.searchSimilar(queryVector, 5);

            // Similarities should be in descending order
            for (let i = 1; i < results.length; i++) {
                expect(results[i - 1].similarity).toBeGreaterThanOrEqual(
                    results[i].similarity
                );
            }
        });

        it('should respect limit parameter', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const results = await store.searchSimilar(queryVector, 2);

            expect(results).toHaveLength(2);
        });

        it('should handle empty cache gracefully', async () => {
            // Create fresh store with empty cache
            await store.close();
            store = new CachedVectorStore(mockSessionManager);

            const queryVector = [1.0, 0.0, 0.0];
            const results = await store.searchSimilar(queryVector, 5);

            expect(results).toHaveLength(0);
        });

        it('should return similarity scores between 0 and 1', async () => {
            const queryVector = [1.0, 0.0, 0.0];
            const results = await store.searchSimilar(queryVector, 5);

            for (const result of results) {
                expect(result.similarity).toBeGreaterThanOrEqual(0);
                expect(result.similarity).toBeLessThanOrEqual(1);
            }
        });

        it('should handle query vectors with different magnitudes', async () => {
            const normalizedQuery = [1.0, 0.0, 0.0];
            const scaledQuery = [2.0, 0.0, 0.0]; // Same direction, different magnitude

            const normalizedResults = await store.searchSimilar(
                normalizedQuery,
                5
            );
            const scaledResults = await store.searchSimilar(scaledQuery, 5);

            // Results should be similar (cosine similarity is magnitude-invariant)
            expect(normalizedResults).toHaveLength(scaledResults.length);
            for (let i = 0; i < normalizedResults.length; i++) {
                expect(normalizedResults[i].messageId).toBe(
                    scaledResults[i].messageId
                );
                expect(normalizedResults[i].similarity).toBeCloseTo(
                    scaledResults[i].similarity,
                    2
                );
            }
        });

        it('should return copies of vectors to prevent mutation', async () => {
            const originalVector = [1.0, 2.0, 3.0];
            await store.storeVector(originalVector, 'copy-test');

            const results = await store.searchSimilar(originalVector, 1);
            const returnedVector = results[0].vector;

            // Modify the returned vector
            returnedVector[0] = 999;

            // Search again - should return original vector
            const results2 = await store.searchSimilar(originalVector, 1);
            expect(results2[0].vector[0]).toBe(1.0); // Should be unchanged
        });
    });

    describe('cache management', () => {
        it('should enforce maximum cache limit', async () => {
            // Create store with small cache limit
            await store.close();
            store = new CachedVectorStore(mockSessionManager, 3); // Max 3 vectors

            // Store 5 vectors
            for (let i = 0; i < 5; i++) {
                await store.storeVector([i, 0, 0], `msg-${i}`);
                await new Promise((resolve) => setTimeout(resolve, 1)); // Ensure different timestamps
            }

            // Should only find the last 3 vectors (most recent)
            const results = await store.searchSimilar([0, 0, 0], 10);
            expect(results).toHaveLength(3);

            // Should have messages 2, 3, 4 (the most recent ones)
            const messageIds = results.map((r) => r.messageId).sort();
            expect(messageIds).toEqual(['msg-2', 'msg-3', 'msg-4']);
        });

        it('should clear cache on session switch', async () => {
            // Store some vectors
            await store.storeVector([1, 0, 0], 'session-1-vector');

            let results = await store.searchSimilar([1, 0, 0], 1);
            expect(results).toHaveLength(1);

            // Simulate session change
            const currentSession = await mockSessionManager.getActiveSession();
            const newSession = {
                name: 'new-session',
                lastActiveDate: new Date(),
                database: currentSession.database,
            };
            mockSessionManager.simulateSessionChange(newSession);

            // Wait for async event handling
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Cache should be cleared
            results = await store.searchSimilar([1, 0, 0], 1);
            expect(results).toHaveLength(0);
        });
    });

    describe('edge cases', () => {
        it('should handle zero vectors', async () => {
            const zeroVector = [0.0, 0.0, 0.0];

            await store.storeVector(zeroVector, 'zero-test');

            const results = await store.searchSimilar(zeroVector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe('zero-test');
        });

        it('should handle very small similarity differences', async () => {
            const baseVector = [1.0, 0.0, 0.0];
            const similarVector = [0.9999, 0.0001, 0.0];

            await store.storeVector(baseVector, 'base');
            await store.storeVector(similarVector, 'similar');

            const results = await store.searchSimilar(baseVector, 2);
            expect(results).toHaveLength(2);
            expect(results[0].similarity).toBeGreaterThan(
                results[1].similarity
            );
        });

        it('should handle negative vector components', async () => {
            const negativeVector = [-0.5, -0.5, 0.707];

            await store.storeVector(negativeVector, 'negative-test');

            const results = await store.searchSimilar(negativeVector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBeCloseTo(1.0, 5);
        });

        it('should handle single dimension vectors', async () => {
            const singleDimVector = [1.0];

            await store.storeVector(singleDimVector, 'single-dim');

            const results = await store.searchSimilar(singleDimVector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].similarity).toBeCloseTo(1.0, 5);
        });
    });
});
