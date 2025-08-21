import {
    ChoiceInputMessage,
    ChoiceMessage,
    ErrorMessage,
    FileOperationMessage,
    Message,
    PlainMessage,
    PromptInputMessage,
    PromptMessage,
} from '../../models/messages';
import { MessageRow } from '../../models/sqlite-message';

/**
 * SQLite message parser utility
 *
 * Provides functions to parse database rows into properly typed Message objects.
 * Handles metadata deserialization and type-specific message construction.
 */
export class SQLiteMessageParser {
    /**
     * Parse metadata from JSON string with error handling.
     *
     * @param metadataJson - JSON string containing metadata
     * @param messageId - Message ID for error logging
     * @returns Parsed metadata object or null if parsing fails
     */
    static parseMetadata(metadataJson: string | null): any | null {
        if (!metadataJson) return null;
        try {
            return JSON.parse(metadataJson);
        } catch {
            return null;
        }
    }

    /**
     * Parse a plain message (system, user, agent, taskmaster, summary).
     *
     * @param row - Database row
     * @returns PlainMessage
     */
    static parsePlainMessage(row: MessageRow): PlainMessage {
        return {
            id: row.id,
            content: row.content,
            type: row.type as PlainMessage['type'],
            sender: row.sender,
            timestamp: new Date(row.timestamp),
        };
    }

    /**
     * Parse an error message.
     *
     * @param row - Database row
     * @param metadata - Parsed metadata object
     * @returns ErrorMessage
     */
    static parseErrorMessage(row: MessageRow, metadata: any): ErrorMessage {
        return {
            id: row.id,
            content: row.content,
            type: 'error',
            sender: row.sender,
            timestamp: new Date(row.timestamp),
            metadata,
        };
    }

    /**
     * Parse a file operation message.
     *
     * @param row - Database row
     * @param metadata - Parsed metadata object
     * @returns FileOperationMessage
     */
    static parseFileOperationMessage(
        row: MessageRow,
        metadata: any
    ): FileOperationMessage {
        return {
            id: row.id,
            content: row.content,
            type: 'file_operation',
            sender: row.sender,
            timestamp: new Date(row.timestamp),
            metadata,
        };
    }

    /**
     * Parse a prompt message.
     *
     * @param row - Database row
     * @param metadata - Parsed metadata object
     * @returns PromptMessage
     */
    static parsePromptMessage(row: MessageRow, metadata: any): PromptMessage {
        return {
            id: row.id,
            content: row.content,
            type: 'prompt',
            sender: row.sender,
            timestamp: new Date(row.timestamp),
            metadata,
        };
    }

    /**
     * Parse a choice message.
     *
     * @param row - Database row
     * @param metadata - Parsed metadata object
     * @returns ChoiceMessage
     */
    static parseChoiceMessage(row: MessageRow, metadata: any): ChoiceMessage {
        return {
            id: row.id,
            content: row.content,
            type: 'choice',
            sender: row.sender,
            timestamp: new Date(row.timestamp),
            metadata,
        };
    }

    /**
     * Parse a user choice input message.
     *
     * @param row - Database row
     * @param metadata - Parsed metadata object
     * @returns ChoiceInputMessage
     */
    static parseUserChoiceMessage(
        row: MessageRow,
        metadata: any
    ): ChoiceInputMessage {
        return {
            id: row.id,
            content: row.content,
            type: 'user-choice',
            sender: row.sender,
            timestamp: new Date(row.timestamp),
            metadata,
        };
    }

    /**
     * Parse a user input message.
     *
     * @param row - Database row
     * @param metadata - Parsed metadata object
     * @returns PromptInputMessage
     */
    static parseUserInputMessage(
        row: MessageRow,
        metadata: any
    ): PromptInputMessage {
        return {
            id: row.id,
            content: row.content,
            type: 'user-input',
            sender: row.sender,
            timestamp: new Date(row.timestamp),
            metadata,
        };
    }

    /**
     * Main parser function to convert database row to properly typed Message.
     *
     * @param row - Database row containing message data
     * @returns Properly typed Message object (ErrorMessage, FileOperationMessage, etc.)
     */
    static parseMessageFromRow(row: MessageRow): Message {
        const metadata = SQLiteMessageParser.parseMetadata(row.metadata);

        switch (row.type) {
            case 'error':
                return SQLiteMessageParser.parseErrorMessage(row, metadata);
            case 'file_operation':
                return SQLiteMessageParser.parseFileOperationMessage(
                    row,
                    metadata
                );
            case 'prompt':
                return SQLiteMessageParser.parsePromptMessage(row, metadata);
            case 'choice':
                return SQLiteMessageParser.parseChoiceMessage(row, metadata);
            case 'user-choice':
                return SQLiteMessageParser.parseUserChoiceMessage(
                    row,
                    metadata
                );
            case 'user-input':
                return SQLiteMessageParser.parseUserInputMessage(row, metadata);
            case 'system':
            case 'user':
            case 'agent':
            case 'taskmaster':
            case 'summary':
                return SQLiteMessageParser.parsePlainMessage(row);
            default:
                // Fallback for unknown types
                return SQLiteMessageParser.parsePlainMessage(row);
        }
    }
}

/**
 * Convenience function to parse a single message row.
 *
 * @param row - Database row containing message data
 * @returns Properly typed Message object
 */
export function parseMessageFromRow(row: MessageRow): Message {
    return SQLiteMessageParser.parseMessageFromRow(row);
}

/**
 * Convenience function to parse multiple message rows.
 *
 * @param rows - Array of database rows containing message data
 * @returns Array of properly typed Message objects
 */
export function parseMessagesFromRows(rows: MessageRow[]): Message[] {
    return rows.map((row) => SQLiteMessageParser.parseMessageFromRow(row));
}
