import { describe, it, expect, beforeEach } from 'vitest';
import { MessageRepository } from '../../../../src/application/stores/messages/message-repository';
import { CachedMessageStore } from '../../../../src/application/stores/messages/cached-message-store';
import { SQLiteMessageStore } from '../../../../src/application/stores/messages/sqlite-message-store';
import { MockSessionManager } from './session-manager.mocks';
import {
    Message,
    ErrorMessage,
    FileOperationMessage,
} from '../../../../src/application/models/messages';

describe('MessageRepository', () => {
    let repository: MessageRepository;
    let cachedStore: CachedMessageStore;
    let persistentStore: SQLiteMessageStore;
    let mockSessionManager: MockSessionManager;

    beforeEach(async () => {
        // Use in-memory database for testing
        mockSessionManager = new MockSessionManager(':memory:');

        // Create stores with small cache limit for testing
        cachedStore = new CachedMessageStore(mockSessionManager, 3); // Small cache for testing
        persistentStore = new SQLiteMessageStore(mockSessionManager);

        // Create repository
        repository = new MessageRepository(cachedStore, persistentStore);
    });

    afterEach(async () => {
        await persistentStore.close();
    });

    describe('initialization', () => {
        it('should initialize with injected stores', async () => {
            const testMessage: Message = {
                id: 'test-1',
                content: 'Test message',
                type: 'user',
                sender: 'test-user',
                timestamp: new Date(),
            };

            await repository.storeMessage(testMessage);
            const retrieved = await repository.getMessageById('test-1');
            expect(retrieved).toEqual(testMessage);
        });
    });

    describe('storeMessage', () => {
        it('should store message in both cached and persistent stores', async () => {
            const message: Message = {
                id: 'dual-store-1',
                content: 'Message for both stores',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
            };

            await repository.storeMessage(message);

            // Verify in cached store
            const cachedMessage =
                await cachedStore.getMessageById('dual-store-1');
            expect(cachedMessage).toEqual(message);

            // Verify in persistent store
            const persistentMessage =
                await persistentStore.getMessageById('dual-store-1');
            expect(persistentMessage).toEqual(message);
        });

        it('should handle message replacement in both stores', async () => {
            const originalMessage: Message = {
                id: 'replace-dual',
                content: 'Original content',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
            };

            const updatedMessage: Message = {
                id: 'replace-dual',
                content: 'Updated content',
                type: 'agent',
                sender: 'assistant',
                timestamp: new Date('2023-01-01T10:01:00Z'),
            };

            await repository.storeMessage(originalMessage);
            await repository.storeMessage(updatedMessage);

            // Verify replacement in both stores
            const cachedMessage =
                await cachedStore.getMessageById('replace-dual');
            const persistentMessage =
                await persistentStore.getMessageById('replace-dual');

            expect(cachedMessage).toEqual(updatedMessage);
            expect(persistentMessage).toEqual(updatedMessage);
            expect(cachedMessage!.content).toBe('Updated content');
            expect(persistentMessage!.content).toBe('Updated content');
        });
    });

    describe('storeMessages', () => {
        it('should store multiple messages in both stores', async () => {
            const messages: Message[] = [
                {
                    id: 'batch-1',
                    content: 'First batch message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:00:00Z'),
                },
                {
                    id: 'batch-2',
                    content: 'Second batch message',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:01:00Z'),
                },
            ];

            await repository.storeMessages(messages);

            // Verify in cached store
            const cached1 = await cachedStore.getMessageById('batch-1');
            const cached2 = await cachedStore.getMessageById('batch-2');
            expect(cached1).toEqual(messages[0]);
            expect(cached2).toEqual(messages[1]);

            // Verify in persistent store
            const persistent1 = await persistentStore.getMessageById('batch-1');
            const persistent2 = await persistentStore.getMessageById('batch-2');
            expect(persistent1).toEqual(messages[0]);
            expect(persistent2).toEqual(messages[1]);
        });
    });

    describe('getMessageHistory', () => {
        beforeEach(async () => {
            // Set up test messages - more than cache limit (3)
            const messages: Message[] = [
                {
                    id: 'msg-1',
                    content: 'First message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:00:00Z'),
                },
                {
                    id: 'msg-2',
                    content: 'Second message',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:01:00Z'),
                },
                {
                    id: 'msg-3',
                    content: 'Third message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:02:00Z'),
                },
                {
                    id: 'msg-4',
                    content: 'Fourth message',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:03:00Z'),
                },
                {
                    id: 'msg-5',
                    content: 'Fifth message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:04:00Z'),
                },
            ];

            await repository.storeMessages(messages);
        });

        it('should return cached messages when limit is within cache', async () => {
            const history = await repository.getMessageHistory(2);
            expect(history).toHaveLength(2);
            expect(history[0].content).toBe('Fourth message');
            expect(history[1].content).toBe('Fifth message');
        });

        it('should combine cached and persistent when limit exceeds cache', async () => {
            const history = await repository.getMessageHistory(5);
            expect(history).toHaveLength(5);
            expect(history[0].content).toBe('First message');
            expect(history[4].content).toBe('Fifth message');
        });

        it('should return all messages when no limit specified', async () => {
            const history = await repository.getMessageHistory();
            expect(history).toHaveLength(5);
            expect(history[0].content).toBe('First message');
            expect(history[4].content).toBe('Fifth message');
        });

        it('should respect summary boundaries in cache', async () => {
            // Add a summary message
            const summaryMessage: Message = {
                id: 'summary-1',
                content: 'This is a summary',
                type: 'summary',
                sender: 'system',
                timestamp: new Date('2023-01-01T10:03:30Z'), // Between msg-4 and msg-5
            };

            await repository.storeMessage(summaryMessage);

            // Should stop at summary boundary - return messages up to and including summary
            const history = await repository.getMessageHistory(10);

            // The summary boundary logic returns everything up to and including the summary
            // Cache has limit 3, so it contains [msg-4, summary, msg-5]
            // When cache finds summary, it returns [msg-4, summary]
            expect(history).toHaveLength(2);
            expect(history[0].content).toBe('Fourth message');
            expect(history[1].content).toBe('This is a summary');
            // msg-5 should NOT be included because it comes after the summary
        });

        it('should handle cache overflow correctly', async () => {
            // Add more messages to exceed cache limit
            const additionalMessages: Message[] = [
                {
                    id: 'msg-6',
                    content: 'Sixth message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:05:00Z'),
                },
                {
                    id: 'msg-7',
                    content: 'Seventh message',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:06:00Z'),
                },
            ];

            await repository.storeMessages(additionalMessages);

            // Cache should only have last 3 messages (cache limit)
            const cachedHistory = await cachedStore.getMessageHistory();
            expect(cachedHistory.length).toBeLessThanOrEqual(3);

            // Repository should still return all messages by combining stores
            const fullHistory = await repository.getMessageHistory();
            expect(fullHistory).toHaveLength(7);
            expect(fullHistory[0].content).toBe('First message');
            expect(fullHistory[6].content).toBe('Seventh message');
        });
    });

    describe('getMessageById', () => {
        it('should find message in cached store first', async () => {
            const message: Message = {
                id: 'cached-find',
                content: 'Cached message',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
            };

            await repository.storeMessage(message);
            const retrieved = await repository.getMessageById('cached-find');
            expect(retrieved).toEqual(message);
        });

        it('should fallback to persistent store when not in cache', async () => {
            // Store many messages to push early ones out of cache
            const messages: Message[] = [];
            for (let i = 1; i <= 10; i++) {
                messages.push({
                    id: `overflow-${i}`,
                    content: `Message ${i}`,
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date(
                        `2023-01-01T10:${i.toString().padStart(2, '0')}:00Z`
                    ),
                });
            }

            await repository.storeMessages(messages);

            // Early message should be pushed out of cache but still in persistent
            const retrieved = await repository.getMessageById('overflow-1');
            expect(retrieved).not.toBeNull();
            expect(retrieved!.content).toBe('Message 1');

            // Verify it's not in cache
            const cachedMessage =
                await cachedStore.getMessageById('overflow-1');
            expect(cachedMessage).toBeNull();

            // But it should be in persistent store
            const persistentMessage =
                await persistentStore.getMessageById('overflow-1');
            expect(persistentMessage).not.toBeNull();
        });

        it('should return null for non-existent message', async () => {
            const retrieved = await repository.getMessageById('does-not-exist');
            expect(retrieved).toBeNull();
        });
    });

    describe('getMessagesByType', () => {
        beforeEach(async () => {
            const messages: Message[] = [
                {
                    id: 'user-1',
                    content: 'User message 1',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:00:00Z'),
                },
                {
                    id: 'agent-1',
                    content: 'Agent message 1',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:01:00Z'),
                },
                {
                    id: 'user-2',
                    content: 'User message 2',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:02:00Z'),
                },
                {
                    id: 'error-1',
                    content: 'Error occurred',
                    type: 'error',
                    sender: 'system',
                    timestamp: new Date('2023-01-01T10:03:00Z'),
                },
            ];

            await repository.storeMessages(messages);
        });

        it('should return messages of specified type from persistent store', async () => {
            const userMessages = await repository.getMessagesByType('user');
            expect(userMessages).toHaveLength(2);
            expect(userMessages[0].content).toBe('User message 1');
            expect(userMessages[1].content).toBe('User message 2');
        });

        it('should return empty array for non-existent type', async () => {
            const summaryMessages =
                await repository.getMessagesByType('summary');
            expect(summaryMessages).toHaveLength(0);
        });

        it('should respect limit parameter', async () => {
            const userMessages = await repository.getMessagesByType('user', 1);
            expect(userMessages).toHaveLength(1);
            expect(userMessages[0].content).toBe('User message 2'); // Most recent user message
        });

        it('should return all messages when limit is not specified', async () => {
            const userMessages = await repository.getMessagesByType('user');
            expect(userMessages).toHaveLength(2);
            expect(userMessages[0].content).toBe('User message 1');
            expect(userMessages[1].content).toBe('User message 2');
        });

        it('should return all messages when limit exceeds count', async () => {
            const userMessages = await repository.getMessagesByType('user', 10);
            expect(userMessages).toHaveLength(2);
            expect(userMessages[0].content).toBe('User message 1');
            expect(userMessages[1].content).toBe('User message 2');
        });

        it('should use cache first when limit is satisfied', async () => {
            // Add more messages to exceed cache limit (cache limit is 3)
            const extraMessages: Message[] = [];
            for (let i = 5; i <= 10; i++) {
                extraMessages.push({
                    id: `cache-test-${i}`,
                    content: `Cache test message ${i}`,
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date(
                        `2023-01-01T12:${i.toString().padStart(2, '0')}:00Z`
                    ),
                });
            }
            await repository.storeMessages(extraMessages);

            // Request limit that cache can satisfy (even though it doesn't have all user messages)
            const userMessages = await repository.getMessagesByType('user', 2);
            expect(userMessages).toHaveLength(2);

            // Should get the most recent 2 user messages from cache
            expect(userMessages[0].content).toBe('Cache test message 9');
            expect(userMessages[1].content).toBe('Cache test message 10');
        });

        it('should fallback to persistent store when cache insufficient', async () => {
            // Store many messages to exceed cache limit
            const manyMessages: Message[] = [];
            for (let i = 1; i <= 10; i++) {
                manyMessages.push({
                    id: `fallback-${i}`,
                    content: `Fallback message ${i}`,
                    type: 'fallback-type',
                    sender: 'user1',
                    timestamp: new Date(
                        `2023-01-01T13:${i.toString().padStart(2, '0')}:00Z`
                    ),
                });
            }
            await repository.storeMessages(manyMessages);

            // Request more than cache can provide for this type
            const fallbackMessages = await repository.getMessagesByType(
                'fallback-type',
                8
            );
            expect(fallbackMessages).toHaveLength(8);

            // Should get messages from persistent store
            expect(fallbackMessages[0].content).toBe('Fallback message 3'); // Last 8 messages
            expect(fallbackMessages[7].content).toBe('Fallback message 10');
        });
    });

    describe('searchByRegex', () => {
        beforeEach(async () => {
            const messages: Message[] = [
                {
                    id: 'search-1',
                    content: 'This is a test message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:00:00Z'),
                },
                {
                    id: 'search-2',
                    content: 'Another TEST content',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:01:00Z'),
                },
                {
                    id: 'search-3',
                    content: 'No matching content here',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:02:00Z'),
                },
                {
                    id: 'search-4',
                    content: 'Testing regex patterns',
                    type: 'error',
                    sender: 'system',
                    timestamp: new Date('2023-01-01T10:03:00Z'),
                },
            ];

            await repository.storeMessages(messages);
        });

        it('should search messages using persistent store', async () => {
            const results = await repository.searchByRegex('test');
            expect(results).toHaveLength(3);
            // Check that all expected messages are present (order may vary)
            const contents = results.map((r) => r.content);
            expect(contents).toContain('This is a test message');
            expect(contents).toContain('Another TEST content');
            expect(contents).toContain('Testing regex patterns');
        });

        it('should apply limit and type filters', async () => {
            const results = await repository.searchByRegex('test', 1, 'user');
            expect(results).toHaveLength(1);
            expect(results[0].content).toBe('This is a test message');
            expect(results[0].type).toBe('user');
        });

        it('should return empty array for no matches', async () => {
            const results = await repository.searchByRegex('nonexistent');
            expect(results).toHaveLength(0);
        });

        it('should use cache first when limit is satisfied for search', async () => {
            // Add more test messages to exceed cache limit
            const extraMessages: Message[] = [];
            for (let i = 5; i <= 10; i++) {
                extraMessages.push({
                    id: `search-cache-${i}`,
                    content: `Cache test pattern ${i}`,
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date(
                        `2023-01-01T14:${i.toString().padStart(2, '0')}:00Z`
                    ),
                });
            }
            await repository.storeMessages(extraMessages);

            // Search with limit that cache can satisfy
            const results = await repository.searchByRegex('test', 2);
            expect(results).toHaveLength(2);

            // Should get matches from cache (cache only has recent items due to maxCachedCount=3)
            const contents = results.map((r) => r.content);
            expect(contents.every((content) => content.includes('test'))).toBe(
                true
            );
            // Verify we got results from cache (most recent matching messages)
            expect(contents).toContain('Cache test pattern 8');
            expect(contents).toContain('Cache test pattern 9');
        });

        it('should fallback to persistent store when cache search insufficient', async () => {
            // Store many messages with search pattern to exceed cache
            const manyMessages: Message[] = [];
            for (let i = 1; i <= 10; i++) {
                manyMessages.push({
                    id: `search-fallback-${i}`,
                    content: `Fallback search pattern ${i}`,
                    type: 'search-test',
                    sender: 'user1',
                    timestamp: new Date(
                        `2023-01-01T15:${i.toString().padStart(2, '0')}:00Z`
                    ),
                });
            }
            await repository.storeMessages(manyMessages);

            // Search with limit that cache cannot satisfy
            const results = await repository.searchByRegex('search pattern', 8);
            expect(results).toHaveLength(8);

            // Should get results from persistent store - verify all contain the pattern
            const contents = results.map((r) => r.content);
            expect(
                contents.every((content) => content.includes('search pattern'))
            ).toBe(true);
            // Verify we got comprehensive results from persistent store
            expect(contents[0]).toBe('Fallback search pattern 10'); // Most recent first
            expect(contents[7]).toBe('Fallback search pattern 3'); // 8th most recent
        });
    });

    describe('cache behavior with maxCachedCount', () => {
        it('should enforce cache limit and maintain functionality', async () => {
            // Store more messages than cache limit (3)
            const messages: Message[] = [];
            for (let i = 1; i <= 5; i++) {
                messages.push({
                    id: `limit-test-${i}`,
                    content: `Message ${i}`,
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date(
                        `2023-01-01T10:${i.toString().padStart(2, '0')}:00Z`
                    ),
                });
            }

            await repository.storeMessages(messages);

            // Cache should only have last 3 messages
            const cachedHistory = await cachedStore.getMessageHistory();
            expect(cachedHistory.length).toBeLessThanOrEqual(3);

            // Repository should still return all messages
            const fullHistory = await repository.getMessageHistory();
            expect(fullHistory).toHaveLength(5);

            // Verify early messages are accessible via repository (from persistent store)
            const earlyMessage =
                await repository.getMessageById('limit-test-1');
            expect(earlyMessage).not.toBeNull();
            expect(earlyMessage!.content).toBe('Message 1');

            // Verify recent messages are accessible via repository (from cache)
            const recentMessage =
                await repository.getMessageById('limit-test-5');
            expect(recentMessage).not.toBeNull();
            expect(recentMessage!.content).toBe('Message 5');
        });
    });
});
