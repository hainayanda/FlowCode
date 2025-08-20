import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    ChoiceInputMessage,
    ChoiceMessage,
    ErrorMessage,
    FileOperationMessage,
    Message,
    PromptInputMessage,
    PromptMessage,
} from '../../../../src/application/models/messages';
import { SQLiteMessageStore } from '../../../../src/application/stores/messages/sqlite-message-store';
import { MockSessionManager } from './session-manager.mocks';

describe('SQLiteMessageStore', () => {
    let store: SQLiteMessageStore;
    let mockSessionManager: MockSessionManager;

    beforeEach(() => {
        // Use in-memory database for testing
        mockSessionManager = new MockSessionManager(':memory:');
        store = new SQLiteMessageStore(mockSessionManager);
    });

    afterEach(async () => {
        await store.close();
    });

    describe('initialization', () => {
        it('should create database tables on first use', async () => {
            const testMessage: Message = {
                id: 'test-1',
                content: 'Test message',
                type: 'user',
                sender: 'test-user',
                timestamp: new Date(),
            };

            // This should trigger database initialization
            await store.storeMessage(testMessage);

            // Verify the message was stored
            const retrieved = await store.getMessageById('test-1');
            expect(retrieved).not.toBeNull();
            expect(retrieved!.content).toBe('Test message');
        });
    });

    describe('storeMessage', () => {
        it('should store a plain message', async () => {
            const message: Message = {
                id: 'plain-1',
                content: 'Hello world',
                type: 'user',
                sender: 'john',
                timestamp: new Date('2023-01-01T12:00:00Z'),
            };

            await store.storeMessage(message);

            const retrieved = await store.getMessageById('plain-1');
            expect(retrieved).toEqual(message);
        });

        it('should store an error message with metadata', async () => {
            const errorMessage: ErrorMessage = {
                id: 'error-1',
                content: 'An error occurred',
                type: 'error',
                sender: 'system',
                timestamp: new Date('2023-01-01T12:00:00Z'),
                metadata: {
                    error: new Error('Test error'),
                    stack: 'Error: Test error\n    at test.js:1:1',
                },
            };

            await store.storeMessage(errorMessage);

            const retrieved = (await store.getMessageById(
                'error-1'
            )) as ErrorMessage;
            expect(retrieved).not.toBeNull();
            expect(retrieved.type).toBe('error');
            expect(retrieved.metadata.error).toBeDefined();
            expect(retrieved.metadata.stack).toBe(
                'Error: Test error\n    at test.js:1:1'
            );
        });

        it('should store a file operation message with metadata', async () => {
            const fileOpMessage: FileOperationMessage = {
                id: 'file-op-1',
                content: 'File modified successfully',
                type: 'file_operation',
                sender: 'system',
                timestamp: new Date('2023-01-01T12:00:00Z'),
                metadata: {
                    filePath: '/path/to/file.ts',
                    diffs: [
                        {
                            lineNumber: 10,
                            type: 'modified',
                            oldText: 'old code',
                            newText: 'new code',
                        },
                    ],
                },
            };

            await store.storeMessage(fileOpMessage);

            const retrieved = (await store.getMessageById(
                'file-op-1'
            )) as FileOperationMessage;
            expect(retrieved).not.toBeNull();
            expect(retrieved.type).toBe('file_operation');
            expect(retrieved.metadata.filePath).toBe('/path/to/file.ts');
            expect(retrieved.metadata.diffs).toHaveLength(1);
        });

        it('should replace message with same ID', async () => {
            const originalMessage: Message = {
                id: 'replace-test',
                content: 'Original content',
                type: 'user',
                sender: 'john',
                timestamp: new Date('2023-01-01T12:00:00Z'),
            };

            const updatedMessage: Message = {
                id: 'replace-test',
                content: 'Updated content',
                type: 'agent',
                sender: 'assistant',
                timestamp: new Date('2023-01-01T13:00:00Z'),
            };

            await store.storeMessage(originalMessage);
            await store.storeMessage(updatedMessage);

            const retrieved = await store.getMessageById('replace-test');
            expect(retrieved).toEqual(updatedMessage);
        });
    });

    describe('storeMessages', () => {
        it('should store multiple messages in a transaction', async () => {
            const messages: Message[] = [
                {
                    id: 'batch-1',
                    content: 'First message',
                    type: 'user',
                    sender: 'john',
                    timestamp: new Date('2023-01-01T12:00:00Z'),
                },
                {
                    id: 'batch-2',
                    content: 'Second message',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T12:01:00Z'),
                },
                {
                    id: 'batch-3',
                    content: 'Third message',
                    type: 'system',
                    sender: 'system',
                    timestamp: new Date('2023-01-01T12:02:00Z'),
                },
            ];

            await store.storeMessages(messages);

            for (const message of messages) {
                const retrieved = await store.getMessageById(message.id);
                expect(retrieved).toEqual(message);
            }
        });

        it('should handle empty message array', async () => {
            await expect(store.storeMessages([])).resolves.not.toThrow();
        });
    });

    describe('getMessageById', () => {
        it('should return null for non-existent message', async () => {
            const result = await store.getMessageById('non-existent');
            expect(result).toBeNull();
        });

        it('should retrieve stored message by ID', async () => {
            const message: Message = {
                id: 'get-test',
                content: 'Retrievable message',
                type: 'user',
                sender: 'john',
                timestamp: new Date('2023-01-01T12:00:00Z'),
            };

            await store.storeMessage(message);
            const retrieved = await store.getMessageById('get-test');

            expect(retrieved).toEqual(message);
        });
    });

    describe('getMessagesByType', () => {
        beforeEach(async () => {
            const messages: Message[] = [
                {
                    id: 'user-1',
                    content: 'User message 1',
                    type: 'user',
                    sender: 'john',
                    timestamp: new Date('2023-01-01T12:00:00Z'),
                },
                {
                    id: 'user-2',
                    content: 'User message 2',
                    type: 'user',
                    sender: 'jane',
                    timestamp: new Date('2023-01-01T12:01:00Z'),
                },
                {
                    id: 'agent-1',
                    content: 'Agent message 1',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T12:02:00Z'),
                },
                {
                    id: 'system-1',
                    content: 'System message 1',
                    type: 'system',
                    sender: 'system',
                    timestamp: new Date('2023-01-01T12:03:00Z'),
                },
            ];
            await store.storeMessages(messages);
        });

        it('should return messages of specified type', async () => {
            const userMessages = await store.getMessagesByType('user');
            expect(userMessages).toHaveLength(2);
            expect(userMessages.every((msg) => msg.type === 'user')).toBe(true);
            expect(userMessages[0].id).toBe('user-1'); // Should be in chronological order
            expect(userMessages[1].id).toBe('user-2');
        });

        it('should return empty array for type with no messages', async () => {
            const errorMessages = await store.getMessagesByType('error');
            expect(errorMessages).toHaveLength(0);
        });

        it('should return messages in chronological order', async () => {
            const allMessages = await store.getMessagesByType('user');
            expect(allMessages[0].timestamp.getTime()).toBeLessThan(
                allMessages[1].timestamp.getTime()
            );
        });

        it('should respect limit parameter', async () => {
            const userMessages = await store.getMessagesByType('user', 1);
            expect(userMessages).toHaveLength(1);
            expect(userMessages[0].id).toBe('user-2'); // Most recent user message
        });

        it('should return all messages when limit is not specified', async () => {
            const userMessages = await store.getMessagesByType('user');
            expect(userMessages).toHaveLength(2);
            expect(userMessages[0].id).toBe('user-1');
            expect(userMessages[1].id).toBe('user-2');
        });

        it('should return all messages when limit exceeds count', async () => {
            const userMessages = await store.getMessagesByType('user', 10);
            expect(userMessages).toHaveLength(2);
            expect(userMessages[0].id).toBe('user-1');
            expect(userMessages[1].id).toBe('user-2');
        });
    });

    describe('getMessageHistory', () => {
        beforeEach(async () => {
            const messages: Message[] = [
                {
                    id: 'hist-1',
                    content: 'Message 1',
                    type: 'user',
                    sender: 'john',
                    timestamp: new Date('2023-01-01T12:00:00Z'),
                },
                {
                    id: 'hist-2',
                    content: 'Message 2',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T12:01:00Z'),
                },
                {
                    id: 'hist-3',
                    content: 'Summary of conversation',
                    type: 'summary',
                    sender: 'system',
                    timestamp: new Date('2023-01-01T12:02:00Z'),
                },
                {
                    id: 'hist-4',
                    content: 'Message after summary',
                    type: 'user',
                    sender: 'john',
                    timestamp: new Date('2023-01-01T12:03:00Z'),
                },
                {
                    id: 'hist-5',
                    content: 'Latest message',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T12:04:00Z'),
                },
            ];
            await store.storeMessages(messages);
        });

        it('should return messages in chronological order', async () => {
            const history = await store.getMessageHistory();
            expect(history).toHaveLength(3); // Should return everything up to and including summary
            expect(history[0].id).toBe('hist-1'); // Messages before summary
            expect(history[1].id).toBe('hist-2');
            expect(history[2].id).toBe('hist-3'); // Summary message (excludes hist-4, hist-5)
        });

        it('should respect limit parameter', async () => {
            const history = await store.getMessageHistory(2);
            expect(history).toHaveLength(2);
            expect(history[0].id).toBe('hist-2'); // Last 2 messages from valid range up to summary
            expect(history[1].id).toBe('hist-3'); // Summary message
        });

        it('should return all messages if no summary found', async () => {
            // Store messages without summary
            await store.close();
            mockSessionManager.setMockDbPath(':memory:');
            store = new SQLiteMessageStore(mockSessionManager);

            const messages: Message[] = [
                {
                    id: 'no-sum-1',
                    content: 'Message 1',
                    type: 'user',
                    sender: 'john',
                    timestamp: new Date('2023-01-01T12:00:00Z'),
                },
                {
                    id: 'no-sum-2',
                    content: 'Message 2',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T12:01:00Z'),
                },
            ];
            await store.storeMessages(messages);

            const history = await store.getMessageHistory();
            expect(history).toHaveLength(2);
            expect(history[0].id).toBe('no-sum-1');
            expect(history[1].id).toBe('no-sum-2');
        });
    });

    describe('searchByRegex', () => {
        beforeEach(async () => {
            const messages: Message[] = [
                {
                    id: 'search-1',
                    content: 'Hello world',
                    type: 'user',
                    sender: 'john',
                    timestamp: new Date('2023-01-01T12:00:00Z'),
                },
                {
                    id: 'search-2',
                    content: 'Goodbye world',
                    type: 'user',
                    sender: 'jane',
                    timestamp: new Date('2023-01-01T12:01:00Z'),
                },
                {
                    id: 'search-3',
                    content: 'Hello universe',
                    type: 'agent',
                    sender: 'assistant',
                    timestamp: new Date('2023-01-01T12:02:00Z'),
                },
                {
                    id: 'search-4',
                    content: 'Testing message',
                    type: 'system',
                    sender: 'system',
                    timestamp: new Date('2023-01-01T12:03:00Z'),
                },
            ];
            await store.storeMessages(messages);
        });

        it('should find messages matching regex pattern', async () => {
            const results = await store.searchByRegex('Hello');
            expect(results).toHaveLength(2);
            expect(results.every((msg) => msg.content.includes('Hello'))).toBe(
                true
            );
        });

        it('should support LIKE patterns with wildcards', async () => {
            const results = await store.searchByRegex('%world');
            expect(results).toHaveLength(2);
            expect(results.every((msg) => msg.content.endsWith('world'))).toBe(
                true
            );
        });

        it('should filter by message type when specified', async () => {
            const results = await store.searchByRegex(
                'Hello',
                undefined,
                'user'
            );
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe('search-1');
            expect(results[0].type).toBe('user');
        });

        it('should respect limit parameter', async () => {
            const results = await store.searchByRegex('world', 1);
            expect(results).toHaveLength(1);
        });

        it('should return empty array for no matches', async () => {
            const results = await store.searchByRegex('nonexistent');
            expect(results).toHaveLength(0);
        });

        it('should return results in reverse chronological order', async () => {
            const results = await store.searchByRegex('Hello');
            expect(results[0].timestamp.getTime()).toBeGreaterThan(
                results[1].timestamp.getTime()
            );
        });
    });

    describe('complex message types', () => {
        it('should handle prompt messages correctly', async () => {
            const promptMessage: PromptMessage = {
                id: 'prompt-1',
                content: 'asking user for input: What is your name?',
                type: 'prompt',
                sender: 'system',
                timestamp: new Date(),
                metadata: {
                    prompt: 'What is your name?',
                },
            };

            await store.storeMessage(promptMessage);
            const retrieved = (await store.getMessageById(
                'prompt-1'
            )) as PromptMessage;

            expect(retrieved.type).toBe('prompt');
            expect(retrieved.metadata.prompt).toBe('What is your name?');
        });

        it('should handle choice messages correctly', async () => {
            const choiceMessage: ChoiceMessage = {
                id: 'choice-1',
                content: 'asking user for choices: Pick a color',
                type: 'choice',
                sender: 'system',
                timestamp: new Date(),
                metadata: {
                    prompt: 'Pick a color',
                    choices: [
                        { label: 'Red', value: 'red' },
                        { label: 'Blue', value: 'blue' },
                    ],
                },
            };

            await store.storeMessage(choiceMessage);
            const retrieved = (await store.getMessageById(
                'choice-1'
            )) as ChoiceMessage;

            expect(retrieved.type).toBe('choice');
            expect(retrieved.metadata.choices).toHaveLength(2);
            expect(retrieved.metadata.choices[0].label).toBe('Red');
        });

        it('should handle user choice input messages correctly', async () => {
            const choiceInputMessage: ChoiceInputMessage = {
                id: 'choice-input-1',
                content: 'user has made a choice: Red (red)',
                type: 'user-choice',
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    choice: 0,
                    choices: [
                        { label: 'Red', value: 'red' },
                        { label: 'Blue', value: 'blue' },
                    ],
                },
            };

            await store.storeMessage(choiceInputMessage);
            const retrieved = (await store.getMessageById(
                'choice-input-1'
            )) as ChoiceInputMessage;

            expect(retrieved.type).toBe('user-choice');
            expect(retrieved.metadata.choice).toBe(0);
        });

        it('should handle user input messages correctly', async () => {
            const userInputMessage: PromptInputMessage = {
                id: 'user-input-1',
                content: 'user has provided an input: John Doe',
                type: 'user-input',
                sender: 'user',
                timestamp: new Date(),
                metadata: {
                    prompt: 'What is your name?',
                    input: 'John Doe',
                },
            };

            await store.storeMessage(userInputMessage);
            const retrieved = (await store.getMessageById(
                'user-input-1'
            )) as PromptInputMessage;

            expect(retrieved.type).toBe('user-input');
            expect(retrieved.metadata.input).toBe('John Doe');
            expect(retrieved.metadata.prompt).toBe('What is your name?');
        });
    });

    describe('database connection management', () => {
        it('should close database connection', async () => {
            const message: Message = {
                id: 'close-test',
                content: 'Test message',
                type: 'user',
                sender: 'test',
                timestamp: new Date(),
            };

            await store.storeMessage(message);
            await store.close();

            // After closing, should be able to use again (will reinitialize)
            await store.storeMessage(message);
            const retrieved = await store.getMessageById('close-test');
            expect(retrieved).toEqual(message);
        });
    });

    describe('session change reactivity', () => {
        it('should switch databases when session changes', async () => {
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
                messageDbPath: ':memory:',
                vectorDbPath: '/tmp/new-vector.db',
            };
            mockSessionManager.simulateSessionChange(newSession);

            // Wait a tick for async event handling
            await new Promise((resolve) => setImmediate(resolve));

            // Store a message in the new session
            const message2: Message = {
                id: 'session-2-msg',
                content: 'Message in session 2',
                type: 'user',
                sender: 'user2',
                timestamp: new Date(),
            };
            await store.storeMessage(message2);

            // Message from first session should not exist in new session
            const notFound = await store.getMessageById('session-1-msg');
            expect(notFound).toBeNull();

            // Message from new session should exist
            const found = await store.getMessageById('session-2-msg');
            expect(found).toEqual(message2);
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
                messageDbPath: ':memory:',
                vectorDbPath: '/tmp/test.db',
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
            // Store a message to initialize first database
            const message: Message = {
                id: 'init-msg',
                content: 'Initial message',
                type: 'user',
                sender: 'user',
                timestamp: new Date(),
            };
            await store.storeMessage(message);

            // Switch sessions - this should close the previous database
            const newSession = {
                name: 'switch-test',
                lastActiveDate: new Date(),
                messageDbPath: ':memory:',
                vectorDbPath: '/tmp/switch.db',
            };
            mockSessionManager.simulateSessionChange(newSession);

            // Wait for async handling
            await new Promise((resolve) => setImmediate(resolve));

            // Should be able to use store normally after session switch
            const newMessage: Message = {
                id: 'new-session-msg',
                content: 'New session message',
                type: 'agent',
                sender: 'assistant',
                timestamp: new Date(),
            };
            await store.storeMessage(newMessage);

            const retrieved = await store.getMessageById('new-session-msg');
            expect(retrieved).toEqual(newMessage);
        });

        it('should not emit events when switching to the same session', async () => {
            let eventCount = 0;
            const eventHandler = () => {
                eventCount++;
            };

            mockSessionManager.on('session-changed', eventHandler);

            // Switch to current session (should not emit event)
            await mockSessionManager.switchToSession('test-session');

            // Should not have received any events
            expect(eventCount).toBe(0);

            mockSessionManager.removeListener('session-changed', eventHandler);
        });

        it('should not emit events when updating last active date', async () => {
            let eventCount = 0;
            const eventHandler = () => {
                eventCount++;
            };

            mockSessionManager.on('session-changed', eventHandler);

            // Update last active date (should not emit event)
            await mockSessionManager.updateLastActiveDate();

            // Should not have received any events
            expect(eventCount).toBe(0);

            mockSessionManager.removeListener('session-changed', eventHandler);
        });

        it('should only emit events when actually switching sessions', async () => {
            let eventCount = 0;
            let lastEvent: any = null;
            const eventHandler = (event: any) => {
                eventCount++;
                lastEvent = event;
            };

            mockSessionManager.on('session-changed', eventHandler);

            // Switch to a different session (should emit event)
            await mockSessionManager.switchToSession('different-session');
            expect(eventCount).toBe(1);
            expect(lastEvent.type).toBe('session-switched');
            expect(lastEvent.activeSession.name).toBe('different-session');

            // Switch to same session again (should not emit event)
            await mockSessionManager.switchToSession('different-session');
            expect(eventCount).toBe(1); // Still 1, no new event

            mockSessionManager.removeListener('session-changed', eventHandler);
        });
    });
});
