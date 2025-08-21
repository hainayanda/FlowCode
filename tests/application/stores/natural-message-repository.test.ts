import { beforeEach, describe, expect, it } from 'vitest';
import { Message } from '../../../src/application/models/messages';
import { NaturalMessageRepository } from '../../../src/application/stores/natural-message-repository';
import {
    MockAgentEmbedder,
    MockMessageStore,
    MockVectorStore,
} from './natural-message-repository.mocks';

describe('NaturalMessageRepository', () => {
    let repository: NaturalMessageRepository;
    let mockEmbedder: MockAgentEmbedder;
    let mockVectorStore: MockVectorStore;
    let mockMessageStore: MockMessageStore;

    beforeEach(() => {
        mockEmbedder = new MockAgentEmbedder(true);
        mockVectorStore = new MockVectorStore();
        mockMessageStore = new MockMessageStore();
        repository = new NaturalMessageRepository(
            mockEmbedder,
            mockVectorStore,
            mockMessageStore
        );
    });

    describe('initialization', () => {
        it('should initialize with provided dependencies', () => {
            expect(repository.isVectorSearchAvailable).toBe(true);
        });

        it('should indicate vector search unavailable when embedder not available', () => {
            mockEmbedder.setAvailable(false);
            expect(repository.isVectorSearchAvailable).toBe(false);
        });
    });

    describe('storeMessage', () => {
        it('should store message in message store and vector store when embedder available', async () => {
            const message: Message = {
                id: 'test-1',
                content: 'test message',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
            };

            await repository.storeMessage(message);

            // Verify message stored in message store
            const retrievedMessage =
                await mockMessageStore.getMessageById('test-1');
            expect(retrievedMessage).toEqual(message);

            // Verify vector stored in vector store
            const storedVectors = mockVectorStore.getStoredVectors();
            expect(storedVectors.size).toBe(1);
            const vectorEntry = Array.from(storedVectors.values())[0];
            expect(vectorEntry.messageId).toBe('test-1');
            expect(vectorEntry.vector).toEqual([0.1, 0.2, 0.3]); // From mock embedding
        });

        it('should only store in message store when embedder not available', async () => {
            mockEmbedder.setAvailable(false);
            const message: Message = {
                id: 'test-2',
                content: 'test message',
                type: 'user',
                sender: 'user1',
                timestamp: new Date(),
            };

            await repository.storeMessage(message);

            // Verify message stored in message store
            const retrievedMessage =
                await mockMessageStore.getMessageById('test-2');
            expect(retrievedMessage).toEqual(message);

            // Verify no vectors stored
            const storedVectors = mockVectorStore.getStoredVectors();
            expect(storedVectors.size).toBe(0);
        });

        it('should throw error when vector storage fails', async () => {
            const message: Message = {
                id: 'test-error',
                content: 'unknown text',
                type: 'user',
                sender: 'user1',
                timestamp: new Date(),
            };

            // Mock embedder to throw error
            mockEmbedder.embed = async () => {
                throw new Error('Embedding failed');
            };

            await expect(repository.storeMessage(message)).rejects.toThrow(
                'Vector storage failed: Error: Embedding failed'
            );
        });
    });

    describe('storeMessages', () => {
        it('should store multiple messages with vectors when embedder available', async () => {
            const messages: Message[] = [
                {
                    id: 'batch-1',
                    content: 'test message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:00:00Z'),
                },
                {
                    id: 'batch-2',
                    content: 'hello world',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:01:00Z'),
                },
            ];

            await repository.storeMessages(messages);

            // Verify both messages stored
            const message1 = await mockMessageStore.getMessageById('batch-1');
            const message2 = await mockMessageStore.getMessageById('batch-2');
            expect(message1).toEqual(messages[0]);
            expect(message2).toEqual(messages[1]);

            // Verify both vectors stored
            const storedVectors = mockVectorStore.getStoredVectors();
            expect(storedVectors.size).toBe(2);
        });

        it('should throw error with message ID when vector storage fails for a specific message', async () => {
            const messages: Message[] = [
                {
                    id: 'good-message',
                    content: 'test message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date(),
                },
                {
                    id: 'bad-message',
                    content: 'failing text',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date(),
                },
            ];

            // Mock embedder to fail on second message
            let callCount = 0;
            mockEmbedder.embed = async (text: string) => {
                callCount++;
                if (callCount === 2) {
                    throw new Error('Embedding failed for second message');
                }
                return [0.1, 0.2, 0.3];
            };

            await expect(repository.storeMessages(messages)).rejects.toThrow(
                'Vector storage failed for message bad-message: Error: Embedding failed for second message'
            );
        });
    });

    describe('searchSimilar', () => {
        beforeEach(async () => {
            // Set up test messages with known embeddings
            const messages: Message[] = [
                {
                    id: 'msg-1',
                    content: 'test message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:00:00Z'),
                },
                {
                    id: 'msg-2',
                    content: 'similar content',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:01:00Z'),
                },
                {
                    id: 'msg-3',
                    content: 'different text',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:02:00Z'),
                },
            ];

            await repository.storeMessages(messages);
        });

        it('should return similar messages ordered by similarity', async () => {
            const results = await repository.searchSimilar('test message');

            expect(results).toHaveLength(3);
            // First result should be exact match
            expect(results[0].id).toBe('msg-1');
            expect(results[0].content).toBe('test message');
            // Second should be similar content (similar embedding)
            expect(results[1].id).toBe('msg-2');
        });

        it('should respect limit parameter', async () => {
            const results = await repository.searchSimilar('test message', 2);

            expect(results).toHaveLength(2);
        });

        it('should filter by message type', async () => {
            const results = await repository.searchSimilar(
                'test message',
                undefined,
                'user'
            );

            expect(results).toHaveLength(2); // Only user messages
            expect(results.every((msg) => msg.type === 'user')).toBe(true);
        });

        it('should return empty array when embedder not available', async () => {
            mockEmbedder.setAvailable(false);
            const results = await repository.searchSimilar('test message');

            expect(results).toEqual([]);
        });

        it('should handle case where vector search returns message IDs not in message store', async () => {
            // Manually add a vector with non-existent message ID
            await mockVectorStore.storeVector(
                [0.1, 0.2, 0.3],
                'non-existent-msg'
            );

            const results = await repository.searchSimilar('test message');

            // Should only return messages that exist in message store
            expect(results.every((msg) => msg.id !== 'non-existent-msg')).toBe(
                true
            );
        });

        it('should throw error when embedding fails', async () => {
            mockEmbedder.embed = async () => {
                throw new Error('Embedding failed');
            };

            await expect(
                repository.searchSimilar('test message')
            ).rejects.toThrow('Vector search failed: Error: Embedding failed');
        });
    });

    describe('MessageReader delegation', () => {
        beforeEach(async () => {
            const messages: Message[] = [
                {
                    id: 'delegation-1',
                    content: 'User message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:00:00Z'),
                },
                {
                    id: 'delegation-2',
                    content: 'Agent message',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:01:00Z'),
                },
                {
                    id: 'delegation-3',
                    content: 'Test content',
                    type: 'error',
                    sender: 'system',
                    timestamp: new Date('2023-01-01T10:02:00Z'),
                },
            ];

            await repository.storeMessages(messages);
        });

        describe('getMessageHistory', () => {
            it('should delegate to message store', async () => {
                const history = await repository.getMessageHistory();
                expect(history).toHaveLength(3);
                expect(history[0].id).toBe('delegation-1');
            });

            it('should respect limit parameter', async () => {
                const history = await repository.getMessageHistory(2);
                expect(history).toHaveLength(2);
            });
        });

        describe('getMessagesByType', () => {
            it('should delegate to message store with type filtering', async () => {
                const userMessages = await repository.getMessagesByType('user');
                expect(userMessages).toHaveLength(1);
                expect(userMessages[0].type).toBe('user');
            });

            it('should respect limit parameter', async () => {
                const messages = await repository.getMessagesByType('user', 1);
                expect(messages).toHaveLength(1);
            });
        });

        describe('searchByRegex', () => {
            it('should delegate to message store with regex search', async () => {
                const results = await repository.searchByRegex('message');
                expect(results).toHaveLength(2); // User message, Agent message
            });

            it('should respect type filter', async () => {
                const results = await repository.searchByRegex(
                    'message',
                    undefined,
                    'user'
                );
                expect(results).toHaveLength(1);
                expect(results[0].type).toBe('user');
            });

            it('should respect limit parameter', async () => {
                const results = await repository.searchByRegex('message', 1);
                expect(results).toHaveLength(1);
            });
        });

        describe('getMessageById', () => {
            it('should delegate to message store', async () => {
                const message = await repository.getMessageById('delegation-1');
                expect(message).not.toBeNull();
                expect(message!.id).toBe('delegation-1');
            });

            it('should return null for non-existent message', async () => {
                const message = await repository.getMessageById('non-existent');
                expect(message).toBeNull();
            });
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle empty vector search results', async () => {
            // Clear vector store but keep messages
            mockVectorStore.clear();

            const results = await repository.searchSimilar('test message');
            expect(results).toEqual([]);
        });

        it('should handle embedder becoming unavailable after construction', async () => {
            const message: Message = {
                id: 'test-unavailable',
                content: 'test message',
                type: 'user',
                sender: 'user1',
                timestamp: new Date(),
            };

            // Store message when embedder is available
            await repository.storeMessage(message);

            // Make embedder unavailable
            mockEmbedder.setAvailable(false);

            // Search should return empty array
            const results = await repository.searchSimilar('test message');
            expect(results).toEqual([]);

            // New messages should only go to message store
            const message2: Message = {
                id: 'test-unavailable-2',
                content: 'another message',
                type: 'user',
                sender: 'user1',
                timestamp: new Date(),
            };

            await repository.storeMessage(message2);

            const retrieved =
                await repository.getMessageById('test-unavailable-2');
            expect(retrieved).toEqual(message2);
        });

        it('should handle vector search with no matching types', async () => {
            await repository.storeMessage({
                id: 'agent-only',
                content: 'test message',
                type: 'agent',
                sender: 'assistant',
                timestamp: new Date(),
            });

            const results = await repository.searchSimilar(
                'test message',
                undefined,
                'user'
            );
            expect(results).toEqual([]);
        });
    });
});
