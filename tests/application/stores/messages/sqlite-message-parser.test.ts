import { describe, it, expect, vi } from 'vitest';
import {
    SQLiteMessageParser,
    parseMessageFromRow,
    parseMessagesFromRows,
} from '../../../../src/application/stores/messages/sqlite-message-parser';
import { MessageRow } from '../../../../src/application/models/sqlite-message';
import {
    Message,
    PlainMessage,
    ErrorMessage,
    FileOperationMessage,
    PromptMessage,
    ChoiceMessage,
    ChoiceInputMessage,
    PromptInputMessage,
} from '../../../../src/application/models/messages';

describe('SQLiteMessageParser', () => {
    const baseTimestamp = Date.now();
    const baseRow: MessageRow = {
        id: 'test-message-1',
        content: 'Test message content',
        type: 'user',
        sender: 'test-user',
        timestamp: baseTimestamp,
        metadata: null,
    };

    describe('parseMetadata', () => {
        it('should parse valid JSON metadata', () => {
            const metadata = { test: 'value', number: 42 };
            const result = SQLiteMessageParser.parseMetadata(
                JSON.stringify(metadata),
                'test-id'
            );
            expect(result).toEqual(metadata);
        });

        it('should return null for null metadata', () => {
            const result = SQLiteMessageParser.parseMetadata(null, 'test-id');
            expect(result).toBeNull();
        });

        it('should return null and log warning for invalid JSON', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const result = SQLiteMessageParser.parseMetadata(
                'invalid-json',
                'test-id'
            );

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to parse metadata for message test-id:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('parsePlainMessage', () => {
        it('should parse a plain user message', () => {
            const row: MessageRow = { ...baseRow, type: 'user' };
            const result = SQLiteMessageParser.parsePlainMessage(row);

            expect(result).toEqual({
                id: 'test-message-1',
                content: 'Test message content',
                type: 'user',
                sender: 'test-user',
                timestamp: new Date(baseTimestamp),
            });
        });

        it('should parse system message', () => {
            const row: MessageRow = { ...baseRow, type: 'system' };
            const result = SQLiteMessageParser.parsePlainMessage(row);
            expect(result.type).toBe('system');
        });

        it('should parse agent message', () => {
            const row: MessageRow = { ...baseRow, type: 'agent' };
            const result = SQLiteMessageParser.parsePlainMessage(row);
            expect(result.type).toBe('agent');
        });

        it('should parse taskmaster message', () => {
            const row: MessageRow = { ...baseRow, type: 'taskmaster' };
            const result = SQLiteMessageParser.parsePlainMessage(row);
            expect(result.type).toBe('taskmaster');
        });

        it('should parse summary message', () => {
            const row: MessageRow = { ...baseRow, type: 'summary' };
            const result = SQLiteMessageParser.parsePlainMessage(row);
            expect(result.type).toBe('summary');
        });
    });

    describe('parseErrorMessage', () => {
        it('should parse error message with metadata', () => {
            const metadata = {
                error: new Error('Test error'),
                stack: 'Error stack trace',
            };
            const row: MessageRow = { ...baseRow, type: 'error' };
            const result = SQLiteMessageParser.parseErrorMessage(row, metadata);

            expect(result).toEqual({
                id: 'test-message-1',
                content: 'Test message content',
                type: 'error',
                sender: 'test-user',
                timestamp: new Date(baseTimestamp),
                metadata,
            } as ErrorMessage);
        });
    });

    describe('parseFileOperationMessage', () => {
        it('should parse file operation message with metadata', () => {
            const metadata = {
                filePath: '/path/to/file.ts',
                diffs: [
                    {
                        lineNumber: 10,
                        type: 'modified' as const,
                        oldText: 'old code',
                        newText: 'new code',
                    },
                ],
            };
            const row: MessageRow = { ...baseRow, type: 'file_operation' };
            const result = SQLiteMessageParser.parseFileOperationMessage(
                row,
                metadata
            );

            expect(result).toEqual({
                id: 'test-message-1',
                content: 'Test message content',
                type: 'file_operation',
                sender: 'test-user',
                timestamp: new Date(baseTimestamp),
                metadata,
            } as FileOperationMessage);
        });
    });

    describe('parsePromptMessage', () => {
        it('should parse prompt message with metadata', () => {
            const metadata = {
                prompt: 'Please enter your name:',
            };
            const row: MessageRow = { ...baseRow, type: 'prompt' };
            const result = SQLiteMessageParser.parsePromptMessage(
                row,
                metadata
            );

            expect(result).toEqual({
                id: 'test-message-1',
                content: 'Test message content',
                type: 'prompt',
                sender: 'test-user',
                timestamp: new Date(baseTimestamp),
                metadata,
            } as PromptMessage);
        });
    });

    describe('parseChoiceMessage', () => {
        it('should parse choice message with metadata', () => {
            const metadata = {
                prompt: 'Choose an option:',
                choices: [
                    { label: 'Option A', value: 'a' },
                    { label: 'Option B', value: 'b' },
                ],
            };
            const row: MessageRow = { ...baseRow, type: 'choice' };
            const result = SQLiteMessageParser.parseChoiceMessage(
                row,
                metadata
            );

            expect(result).toEqual({
                id: 'test-message-1',
                content: 'Test message content',
                type: 'choice',
                sender: 'test-user',
                timestamp: new Date(baseTimestamp),
                metadata,
            } as ChoiceMessage);
        });
    });

    describe('parseUserChoiceMessage', () => {
        it('should parse user choice message with metadata', () => {
            const metadata = {
                choice: 1,
                choices: [
                    { label: 'Option A', value: 'a' },
                    { label: 'Option B', value: 'b' },
                ],
            };
            const row: MessageRow = { ...baseRow, type: 'user-choice' };
            const result = SQLiteMessageParser.parseUserChoiceMessage(
                row,
                metadata
            );

            expect(result).toEqual({
                id: 'test-message-1',
                content: 'Test message content',
                type: 'user-choice',
                sender: 'test-user',
                timestamp: new Date(baseTimestamp),
                metadata,
            } as ChoiceInputMessage);
        });
    });

    describe('parseUserInputMessage', () => {
        it('should parse user input message with metadata', () => {
            const metadata = {
                prompt: 'Enter your name:',
                input: 'John Doe',
            };
            const row: MessageRow = { ...baseRow, type: 'user-input' };
            const result = SQLiteMessageParser.parseUserInputMessage(
                row,
                metadata
            );

            expect(result).toEqual({
                id: 'test-message-1',
                content: 'Test message content',
                type: 'user-input',
                sender: 'test-user',
                timestamp: new Date(baseTimestamp),
                metadata,
            } as PromptInputMessage);
        });
    });

    describe('parseMessageFromRow', () => {
        it('should parse error message correctly', () => {
            const metadata = { error: new Error('Test'), stack: 'stack' };
            const row: MessageRow = {
                ...baseRow,
                type: 'error',
                metadata: JSON.stringify(metadata),
            };
            const result = SQLiteMessageParser.parseMessageFromRow(row);

            expect(result.type).toBe('error');
            expect((result as ErrorMessage).metadata.error).toBeDefined();
        });

        it('should parse file operation message correctly', () => {
            const metadata = {
                filePath: '/test.ts',
                diffs: [
                    { lineNumber: 1, type: 'added' as const, newText: 'new' },
                ],
            };
            const row: MessageRow = {
                ...baseRow,
                type: 'file_operation',
                metadata: JSON.stringify(metadata),
            };
            const result = SQLiteMessageParser.parseMessageFromRow(row);

            expect(result.type).toBe('file_operation');
            expect((result as FileOperationMessage).metadata.filePath).toBe(
                '/test.ts'
            );
        });

        it('should parse prompt message correctly', () => {
            const metadata = { prompt: 'Test prompt' };
            const row: MessageRow = {
                ...baseRow,
                type: 'prompt',
                metadata: JSON.stringify(metadata),
            };
            const result = SQLiteMessageParser.parseMessageFromRow(row);

            expect(result.type).toBe('prompt');
            expect((result as PromptMessage).metadata.prompt).toBe(
                'Test prompt'
            );
        });

        it('should parse choice message correctly', () => {
            const metadata = {
                prompt: 'Choose:',
                choices: [{ label: 'A', value: 'a' }],
            };
            const row: MessageRow = {
                ...baseRow,
                type: 'choice',
                metadata: JSON.stringify(metadata),
            };
            const result = SQLiteMessageParser.parseMessageFromRow(row);

            expect(result.type).toBe('choice');
            expect((result as ChoiceMessage).metadata.choices).toHaveLength(1);
        });

        it('should parse user-choice message correctly', () => {
            const metadata = {
                choice: 0,
                choices: [{ label: 'A', value: 'a' }],
            };
            const row: MessageRow = {
                ...baseRow,
                type: 'user-choice',
                metadata: JSON.stringify(metadata),
            };
            const result = SQLiteMessageParser.parseMessageFromRow(row);

            expect(result.type).toBe('user-choice');
            expect((result as ChoiceInputMessage).metadata.choice).toBe(0);
        });

        it('should parse user-input message correctly', () => {
            const metadata = { prompt: 'Name:', input: 'John' };
            const row: MessageRow = {
                ...baseRow,
                type: 'user-input',
                metadata: JSON.stringify(metadata),
            };
            const result = SQLiteMessageParser.parseMessageFromRow(row);

            expect(result.type).toBe('user-input');
            expect((result as PromptInputMessage).metadata.input).toBe('John');
        });

        it('should parse plain messages (system, user, agent, taskmaster, summary)', () => {
            const types: PlainMessage['type'][] = [
                'system',
                'user',
                'agent',
                'taskmaster',
                'summary',
            ];

            types.forEach((type) => {
                const row: MessageRow = { ...baseRow, type };
                const result = SQLiteMessageParser.parseMessageFromRow(row);
                expect(result.type).toBe(type);
                expect('metadata' in result).toBe(false);
            });
        });

        it('should fallback to plain message for unknown types', () => {
            const row: MessageRow = { ...baseRow, type: 'unknown-type' };
            const result = SQLiteMessageParser.parseMessageFromRow(row);

            expect(result.type).toBe('unknown-type');
            expect('metadata' in result).toBe(false);
        });

        it('should handle invalid metadata gracefully', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const row: MessageRow = {
                ...baseRow,
                type: 'error',
                metadata: 'invalid-json',
            };
            const result = SQLiteMessageParser.parseMessageFromRow(row);

            expect(result.type).toBe('error');
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('convenience functions', () => {
        it('parseMessageFromRow should work as standalone function', () => {
            const row: MessageRow = { ...baseRow, type: 'user' };
            const result = parseMessageFromRow(row);

            expect(result.type).toBe('user');
            expect(result.id).toBe('test-message-1');
        });

        it('parseMessagesFromRows should parse multiple rows', () => {
            const rows: MessageRow[] = [
                { ...baseRow, id: 'msg-1', type: 'user' },
                { ...baseRow, id: 'msg-2', type: 'agent' },
                { ...baseRow, id: 'msg-3', type: 'system' },
            ];
            const results = parseMessagesFromRows(rows);

            expect(results).toHaveLength(3);
            expect(results[0].id).toBe('msg-1');
            expect(results[0].type).toBe('user');
            expect(results[1].id).toBe('msg-2');
            expect(results[1].type).toBe('agent');
            expect(results[2].id).toBe('msg-3');
            expect(results[2].type).toBe('system');
        });

        it('parseMessagesFromRows should handle empty array', () => {
            const results = parseMessagesFromRows([]);
            expect(results).toHaveLength(0);
        });
    });
});
