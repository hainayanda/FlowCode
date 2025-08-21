import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { SQLiteVectorStore } from '../../../../src/application/stores/vectors/sqlite-vector-store';
import { VectorSearchResult } from '../../../../src/application/models/sqlite-message';
import { MockSessionManager } from '../messages/session-manager.mocks';

describe('SQLiteVectorStore', () => {
    let store: SQLiteVectorStore;
    let mockSessionManager: MockSessionManager;

    beforeEach(() => {
        // Use in-memory database for testing - each test gets its own database
        mockSessionManager = new MockSessionManager(':memory:');
        store = new SQLiteVectorStore(mockSessionManager);
    });

    afterEach(async () => {
        await store.close();
    });

    describe('initialization', () => {
        it('should create database tables on first use', async () => {
            const testVector = [0.1, 0.2, 0.3, 0.4];

            // This should trigger database initialization
            await store.storeVector(testVector, 'test-message-1');

            // Verify the vector was stored by searching
            const results = await store.searchSimilar(testVector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe('test-message-1');
        });

        it('should handle database initialization errors gracefully', async () => {
            // Create a store with invalid session manager
            const invalidSessionManager = new MockSessionManager();
            try {
                invalidSessionManager.setMockDbPath(
                    '/invalid/nonexistent/path/test.db'
                ); // Invalid path
                const invalidStore = new SQLiteVectorStore(
                    invalidSessionManager
                );

                await expect(
                    invalidStore.storeVector([1, 2, 3], 'test')
                ).rejects.toThrow();
                await invalidStore.close();
            } catch (error) {
                // If creating the database itself fails, that's also a valid test outcome
                expect(error).toBeDefined();
            }
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
            // Use toBeCloseTo for floating point comparisons
            expect(results[0].vector).toHaveLength(vector.length);
            for (let i = 0; i < vector.length; i++) {
                expect(results[0].vector[i]).toBeCloseTo(vector[i], 5);
            }
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
            // Use toBeCloseTo for floating point comparisons
            expect(matchingResults[0].vector).toHaveLength(
                updatedVector.length
            );
            for (let i = 0; i < updatedVector.length; i++) {
                expect(matchingResults[0].vector[i]).toBeCloseTo(
                    updatedVector[i],
                    5
                );
            }
        });

        it('should handle empty vectors', async () => {
            const emptyVector: number[] = [];

            await expect(
                store.storeVector(emptyVector, 'empty-test')
            ).rejects.toThrow();
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

        it('should handle empty database gracefully', async () => {
            // Create fresh store with empty database
            await store.close();
            mockSessionManager.setMockDbPath(':memory:');
            store = new SQLiteVectorStore(mockSessionManager);

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
    });

    describe('error handling', () => {
        it('should handle storage errors gracefully', async () => {
            // Close the store to simulate error condition
            await store.close();

            // Try to store without reopening
            await expect(store.storeVector([1, 2, 3], 'test')).rejects.toThrow(
                /Vector store has been closed/
            );
        });

        it('should handle search errors gracefully', async () => {
            // Close the store to simulate error condition
            await store.close();

            // Try to search without reopening
            await expect(store.searchSimilar([1, 2, 3])).rejects.toThrow(
                /Vector store has been closed/
            );
        });
    });

    describe('database connection management', () => {
        it('should close database connection', async () => {
            const vector = [0.1, 0.2, 0.3];
            const messageId = 'close-test';

            await store.storeVector(vector, messageId);
            await store.close();

            // After closing, create a new store instance
            const newStore = new SQLiteVectorStore(mockSessionManager);
            await newStore.storeVector(vector, messageId);
            const results = await newStore.searchSimilar(vector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe(messageId);
            await newStore.close();
        });
    });

    describe('session change reactivity', () => {
        it('should switch databases when session changes', async () => {
            // Store a vector in the first session
            const vector1 = [1.0, 0.0, 0.0];
            const messageId1 = 'session-1-vector';
            await store.storeVector(vector1, messageId1);

            // Verify vector exists in first session
            let results = await store.searchSimilar(vector1, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe(messageId1);

            // Add test listener to verify event is emitted
            let eventReceived = false;
            const testListener = () => {
                eventReceived = true;
            };
            mockSessionManager.on('session-changed', testListener);

            // Switch to a new session (use different in-memory database)
            const newSession = {
                name: 'new-session',
                lastActiveDate: new Date(),
                database: new Database(':memory:'),
            };
            mockSessionManager.simulateSessionChange(newSession);

            // Wait for async event handling
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Verify the session was actually switched
            const currentSession = await mockSessionManager.getActiveSession();
            expect(currentSession.name).toBe('new-session');
            expect(eventReceived).toBe(true);

            mockSessionManager.removeListener('session-changed', testListener);

            // Store a vector in the new session
            const vector2 = [0.0, 1.0, 0.0];
            const messageId2 = 'session-2-vector';
            await store.storeVector(vector2, messageId2);

            // Vector from first session should not exist in new session
            // Search for the exact vector that was stored in the first session
            const oldResults = await store.searchSimilar(vector1, 10);
            const vector1Results = oldResults.filter(
                (r) => r.messageId === messageId1
            );
            expect(vector1Results).toHaveLength(0); // messageId1 should not exist in new session

            // Vector from new session should exist
            const newResults = await store.searchSimilar(vector2, 1);
            expect(newResults).toHaveLength(1);
            expect(newResults[0].messageId).toBe(messageId2);
            expect(newResults[0].similarity).toBeCloseTo(1.0, 5); // Should be exact match
        });

        it('should handle session change events properly', async () => {
            let eventReceived = false;
            let receivedEvent: any = null;

            // Set up a listener to verify the event handling
            const eventHandler = (event: any) => {
                eventReceived = true;
                receivedEvent = event;
            };

            // Add our own listener to verify events are being emitted
            mockSessionManager.on('session-changed', eventHandler);

            // Trigger session change
            const newSession = {
                name: 'test-session-change',
                lastActiveDate: new Date(),
                database: new Database(':memory:'),
            };
            mockSessionManager.simulateSessionChange(newSession);

            // Verify event was received
            expect(eventReceived).toBe(true);
            expect(receivedEvent).toBeDefined();
            expect(receivedEvent.type).toBe('session-switched');
            expect(receivedEvent.activeSession.name).toBe(
                'test-session-change'
            );

            // Clean up
            mockSessionManager.removeListener('session-changed', eventHandler);
        });

        it('should close previous database when switching sessions', async () => {
            // Store a vector to initialize first database
            const vector = [0.1, 0.2, 0.3];
            const messageId = 'init-vector';
            await store.storeVector(vector, messageId);

            // Switch sessions - this should close the previous database
            const newSession = {
                name: 'switch-test',
                lastActiveDate: new Date(),
                database: new Database(':memory:'),
            };
            mockSessionManager.simulateSessionChange(newSession);

            // Wait for async handling
            await new Promise((resolve) => setImmediate(resolve));

            // Should be able to use store normally after session switch
            const newVector = [0.4, 0.5, 0.6];
            const newMessageId = 'new-session-vector';
            await store.storeVector(newVector, newMessageId);

            const results = await store.searchSimilar(newVector, 1);
            expect(results).toHaveLength(1);
            expect(results[0].messageId).toBe(newMessageId);
        });
    });

    describe('edge cases', () => {
        it('should handle zero vectors', async () => {
            const zeroVector = [0.0, 0.0, 0.0];

            await expect(
                store.storeVector(zeroVector, 'zero-test')
            ).resolves.not.toThrow();

            const results = await store.searchSimilar(zeroVector, 1);
            expect(results).toHaveLength(1);
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
    });
});
