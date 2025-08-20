import { beforeEach, describe, expect, it } from 'vitest';
import {
    ErrorMessage,
    FileOperationMessage,
    Message,
} from '../../../../src/application/models/messages';
import { CachedMessageStore } from '../../../../src/application/stores/messages/cached-message-store';
import { MockSessionManager } from './session-manager.mocks';

describe('CachedMessageStore', () => {
    let store: CachedMessageStore;
    let mockSessionManager: MockSessionManager;

    beforeEach(() => {
        mockSessionManager = new MockSessionManager();
        store = new CachedMessageStore(mockSessionManager);
    });

    describe('initialization', () => {
        it('should initialize with empty message array', async () => {
            const messages = await store.getMessageHistory();
            expect(messages).toEqual([]);
        });

        it('should initialize session on first use', async () => {
            const testMessage: Message = {
                id: 'test-1',
                content: 'Test message',
                type: 'user',
                sender: 'test-user',
                timestamp: new Date(),
            };

            await store.storeMessage(testMessage);
            const retrieved = await store.getMessageById('test-1');
            expect(retrieved).toEqual(testMessage);
        });
    });

    describe('storeMessage', () => {
        it('should store a plain message', async () => {
            const message: Message = {
                id: 'msg-1',
                content: 'Hello world',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
            };

            await store.storeMessage(message);
            const retrieved = await store.getMessageById('msg-1');
            expect(retrieved).toEqual(message);
        });

        it('should store an error message with metadata', async () => {
            const testError = new Error('Something went wrong');
            const errorMessage: ErrorMessage = {
                id: 'error-1',
                content: 'Something went wrong',
                type: 'error',
                sender: 'system',
                timestamp: new Date('2023-01-01T10:01:00Z'),
                metadata: {
                    error: testError,
                    stack: testError.stack,
                },
            };

            await store.storeMessage(errorMessage);
            const retrieved = (await store.getMessageById(
                'error-1'
            )) as ErrorMessage;
            expect(retrieved).toEqual(errorMessage);
            expect(retrieved.metadata.error.message).toBe(
                'Something went wrong'
            );
            expect(retrieved.metadata.stack).toBeDefined();
        });

        it('should store a file operation message', async () => {
            const fileOpMessage: FileOperationMessage = {
                id: 'file-op-1',
                content: 'File created successfully',
                type: 'file_operation',
                sender: 'system',
                timestamp: new Date('2023-01-01T10:02:00Z'),
                metadata: {
                    filePath: '/tmp/test.txt',
                    diffs: [
                        {
                            lineNumber: 1,
                            type: 'added',
                            newText: 'New file content',
                        },
                    ],
                },
            };

            await store.storeMessage(fileOpMessage);
            const retrieved = (await store.getMessageById(
                'file-op-1'
            )) as FileOperationMessage;
            expect(retrieved).toEqual(fileOpMessage);
            expect(retrieved.metadata.filePath).toBe('/tmp/test.txt');
            expect(retrieved.metadata.diffs).toHaveLength(1);
            expect(retrieved.metadata.diffs[0].type).toBe('added');
        });

        it('should replace existing message with same ID', async () => {
            const originalMessage: Message = {
                id: 'replace-test',
                content: 'Original content',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
            };

            const updatedMessage: Message = {
                id: 'replace-test',
                content: 'Updated content',
                type: 'agent',
                sender: 'assistant',
                timestamp: new Date('2023-01-01T10:01:00Z'),
            };

            await store.storeMessage(originalMessage);
            await store.storeMessage(updatedMessage);

            const retrieved = await store.getMessageById('replace-test');
            expect(retrieved).toEqual(updatedMessage);
            expect(retrieved!.content).toBe('Updated content');

            // Should only have one message, not two
            const allMessages = await store.getMessageHistory();
            expect(allMessages).toHaveLength(1);
        });

        it('should maintain chronological order when storing messages', async () => {
            const message1: Message = {
                id: 'msg-1',
                content: 'First message',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:02:00Z'),
            };

            const message2: Message = {
                id: 'msg-2',
                content: 'Second message',
                type: 'agent',
                sender: 'assistant',
                timestamp: new Date('2023-01-01T10:01:00Z'),
            };

            const message3: Message = {
                id: 'msg-3',
                content: 'Third message',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:03:00Z'),
            };

            // Store in non-chronological order
            await store.storeMessage(message1);
            await store.storeMessage(message2);
            await store.storeMessage(message3);

            const history = await store.getMessageHistory();
            expect(history).toHaveLength(3);
            expect(history[0].content).toBe('Second message'); // Earliest timestamp
            expect(history[1].content).toBe('First message');
            expect(history[2].content).toBe('Third message'); // Latest timestamp
        });
    });

    describe('storeMessages', () => {
        it('should store multiple messages', async () => {
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

            await store.storeMessages(messages);

            const retrieved1 = await store.getMessageById('batch-1');
            const retrieved2 = await store.getMessageById('batch-2');
            expect(retrieved1).toEqual(messages[0]);
            expect(retrieved2).toEqual(messages[1]);
        });
    });

    describe('getMessageHistory', () => {
        beforeEach(async () => {
            // Set up test messages
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
                    id: 'summary-1',
                    content: 'This is a summary',
                    type: 'summary',
                    sender: 'system',
                    timestamp: new Date('2023-01-01T10:02:00Z'),
                },
                {
                    id: 'msg-3',
                    content: 'Third message',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:03:00Z'),
                },
                {
                    id: 'msg-4',
                    content: 'Fourth message',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:04:00Z'),
                },
            ];

            await store.storeMessages(messages);
        });

        it('should return all messages when no limit specified', async () => {
            const history = await store.getMessageHistory();
            // Should stop at summary boundary - includes summary and messages before it (summary represents newer messages)
            expect(history).toHaveLength(3);
            expect(history[0].content).toBe('First message');
            expect(history[1].content).toBe('Second message');
            expect(history[2].content).toBe('This is a summary');
        });

        it('should return limited number of messages', async () => {
            const history = await store.getMessageHistory(3);
            // Processes last 3 messages: Summary, Third, Fourth. Stops at summary (it summarizes Third & Fourth).
            expect(history).toHaveLength(3);
            expect(history[0].content).toBe('First message');
            expect(history[1].content).toBe('Second message');
            expect(history[2].content).toBe('This is a summary');
        });

        it('should stop at summary boundary when limit includes summary', async () => {
            const history = await store.getMessageHistory(4);
            // Processes last 4 messages: Second, Summary, Third, Fourth. Stops at summary.
            expect(history).toHaveLength(3);
            expect(history[0].content).toBe('First message');
            expect(history[1].content).toBe('Second message');
            expect(history[2].content).toBe('This is a summary');
        });

        it('should handle case with no summary messages', async () => {
            // Clear and add messages without summary
            const store2 = new CachedMessageStore(mockSessionManager);
            const messages: Message[] = [
                {
                    id: 'no-summary-1',
                    content: 'Message one',
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date('2023-01-01T10:00:00Z'),
                },
                {
                    id: 'no-summary-2',
                    content: 'Message two',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T10:01:00Z'),
                },
            ];

            await store2.storeMessages(messages);
            const history = await store2.getMessageHistory(1);
            expect(history).toHaveLength(1);
            expect(history[0].content).toBe('Message two');
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

            await store.storeMessages(messages);
        });

        it('should return messages of specified type', async () => {
            const userMessages = await store.getMessagesByType('user');
            expect(userMessages).toHaveLength(2);
            expect(userMessages[0].content).toBe('User message 1');
            expect(userMessages[1].content).toBe('User message 2');
        });

        it('should return empty array for non-existent type', async () => {
            const summaryMessages = await store.getMessagesByType('summary');
            expect(summaryMessages).toHaveLength(0);
        });

        it('should return single message for unique type', async () => {
            const errorMessages = await store.getMessagesByType('error');
            expect(errorMessages).toHaveLength(1);
            expect(errorMessages[0].content).toBe('Error occurred');
        });

        it('should respect limit parameter', async () => {
            const userMessages = await store.getMessagesByType('user', 1);
            expect(userMessages).toHaveLength(1);
            expect(userMessages[0].content).toBe('User message 2'); // Most recent user message
        });

        it('should return all messages when limit is not specified', async () => {
            const userMessages = await store.getMessagesByType('user');
            expect(userMessages).toHaveLength(2);
            expect(userMessages[0].content).toBe('User message 1');
            expect(userMessages[1].content).toBe('User message 2');
        });

        it('should return all messages when limit exceeds count', async () => {
            const userMessages = await store.getMessagesByType('user', 10);
            expect(userMessages).toHaveLength(2);
            expect(userMessages[0].content).toBe('User message 1');
            expect(userMessages[1].content).toBe('User message 2');
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

            await store.storeMessages(messages);
        });

        it('should search messages by regex pattern (case-insensitive)', async () => {
            const results = await store.searchByRegex('test');
            expect(results).toHaveLength(3);
            expect(results[0].content).toBe('This is a test message');
            expect(results[1].content).toBe('Another TEST content');
            expect(results[2].content).toBe('Testing regex patterns');
        });

        it('should apply limit to search results', async () => {
            const results = await store.searchByRegex('test', 2);
            expect(results).toHaveLength(2);
        });

        it('should filter by message type', async () => {
            const results = await store.searchByRegex(
                'test',
                undefined,
                'user'
            );
            expect(results).toHaveLength(1);
            expect(results[0].content).toBe('This is a test message');
        });

        it('should handle regex patterns', async () => {
            const results = await store.searchByRegex('test.*message');
            expect(results).toHaveLength(1);
            expect(results[0].content).toBe('This is a test message');
        });

        it('should fallback to string search for invalid regex', async () => {
            // Invalid regex pattern
            const results = await store.searchByRegex('[invalid');
            expect(results).toHaveLength(0); // '[invalid' doesn't match any content
        });

        it('should return empty array for no matches', async () => {
            const results = await store.searchByRegex('nonexistent');
            expect(results).toHaveLength(0);
        });

        it('should combine type filter and limit', async () => {
            // Add more user messages to test limit with type filter
            await store.storeMessage({
                id: 'search-5',
                content: 'More test content',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:04:00Z'),
            });

            const results = await store.searchByRegex('test', 1, 'user');
            expect(results).toHaveLength(1);
            expect(results[0].type).toBe('user');
        });
    });

    describe('getMessageById', () => {
        it('should return message by ID', async () => {
            const message: Message = {
                id: 'find-me',
                content: 'Find this message',
                type: 'user',
                sender: 'user1',
                timestamp: new Date('2023-01-01T10:00:00Z'),
            };

            await store.storeMessage(message);
            const retrieved = await store.getMessageById('find-me');
            expect(retrieved).toEqual(message);
        });

        it('should return null for non-existent ID', async () => {
            const retrieved = await store.getMessageById('does-not-exist');
            expect(retrieved).toBeNull();
        });
    });

    describe('session change reactivity', () => {
        it('should clear messages when session changes', async () => {
            // Store a message in the first session
            const message1: Message = {
                id: 'session-1-msg',
                content: 'Message in session 1',
                type: 'user',
                sender: 'user1',
                timestamp: new Date(),
            };
            await store.storeMessage(message1);

            // Verify message exists in first session
            let retrieved = await store.getMessageById('session-1-msg');
            expect(retrieved).toEqual(message1);

            // Switch to a new session
            const newSession = {
                name: 'new-session',
                lastActiveDate: new Date(),
                messageDbPath: '/tmp/new-message.db',
                vectorDbPath: '/tmp/new-vector.db',
            };
            mockSessionManager.simulateSessionChange(newSession);

            // Wait a tick for async event handling
            await new Promise((resolve) => setImmediate(resolve));

            // Message from first session should not exist in new session
            const notFound = await store.getMessageById('session-1-msg');
            expect(notFound).toBeNull();

            // Store a message in the new session
            const message2: Message = {
                id: 'session-2-msg',
                content: 'Message in session 2',
                type: 'user',
                sender: 'user2',
                timestamp: new Date(),
            };
            await store.storeMessage(message2);

            // Message from new session should exist
            const found = await store.getMessageById('session-2-msg');
            expect(found).toEqual(message2);

            // Should only have one message (from current session)
            const allMessages = await store.getMessageHistory();
            expect(allMessages).toHaveLength(1);
            expect(allMessages[0]).toEqual(message2);
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
                messageDbPath: '/tmp/test-message.db',
                vectorDbPath: '/tmp/test-vector.db',
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

        it('should not clear messages on session-updated events', async () => {
            // Store a message
            const message: Message = {
                id: 'update-test',
                content: 'Test message',
                type: 'user',
                sender: 'user1',
                timestamp: new Date(),
            };
            await store.storeMessage(message);

            // Simulate session update (not switch)
            const currentSession = await mockSessionManager.getActiveSession();
            const updateEvent = {
                type: 'session-updated' as const,
                activeSession: currentSession,
                previousSession: currentSession,
                timestamp: new Date(),
            };
            mockSessionManager.emit('session-changed', updateEvent);

            // Wait a tick for async event handling
            await new Promise((resolve) => setImmediate(resolve));

            // Message should still exist (not cleared on update)
            const retrieved = await store.getMessageById('update-test');
            expect(retrieved).toEqual(message);
        });
    });

    describe('maxCachedCount behavior', () => {
        it('should enforce cache limit by removing oldest messages', async () => {
            // Create store with small cache limit
            const smallCacheStore = new CachedMessageStore(
                mockSessionManager,
                3
            );

            // Store more messages than cache limit
            const messages: Message[] = [];
            for (let i = 1; i <= 5; i++) {
                messages.push({
                    id: `cache-limit-${i}`,
                    content: `Message ${i}`,
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date(
                        `2023-01-01T10:${i.toString().padStart(2, '0')}:00Z`
                    ),
                });
            }

            await smallCacheStore.storeMessages(messages);

            // Should only have last 3 messages (cache limit)
            const history = await smallCacheStore.getMessageHistory();
            expect(history).toHaveLength(3);
            expect(history[0].content).toBe('Message 3'); // Oldest kept
            expect(history[1].content).toBe('Message 4');
            expect(history[2].content).toBe('Message 5'); // Most recent

            // Early messages should not be in cache
            const earlyMessage =
                await smallCacheStore.getMessageById('cache-limit-1');
            expect(earlyMessage).toBeNull();

            // Recent messages should be in cache
            const recentMessage =
                await smallCacheStore.getMessageById('cache-limit-5');
            expect(recentMessage).not.toBeNull();
        });

        it('should use default cache limit of 100', async () => {
            const defaultStore = new CachedMessageStore(mockSessionManager);

            // Store 50 messages - should all be cached
            const messages: Message[] = [];
            for (let i = 1; i <= 50; i++) {
                messages.push({
                    id: `default-${i}`,
                    content: `Message ${i}`,
                    type: 'user',
                    sender: 'user1',
                    timestamp: new Date(
                        `2023-01-01T10:${i.toString().padStart(2, '0')}:00Z`
                    ),
                });
            }

            await defaultStore.storeMessages(messages);

            // All 50 should be in cache
            const history = await defaultStore.getMessageHistory();
            expect(history).toHaveLength(50);
            expect(history[0].content).toBe('Message 1');
            expect(history[49].content).toBe('Message 50');
        });
    });
});
