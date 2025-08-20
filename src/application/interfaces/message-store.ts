import { Message } from '../models/messages';

/**
 * Message reader interface for retrieving stored messages
 */
export interface MessageReader {
    /**
     * Get message history with optional limit
     */
    getMessageHistory(limit?: number): Promise<Message[]>;

    /**
     * Get messages by type
     */
    getMessagesByType(
        type: Message['type'],
        limit?: number
    ): Promise<Message[]>;

    /**
     * Search messages by regex pattern with optional type filtering
     */
    searchByRegex(
        pattern: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]>;

    /**
     * Get message by ID
     */
    getMessageById(messageId: string): Promise<Message | null>;
}

/**
 * Message writer interface for storing messages
 */
export interface MessageWriter {
    /**
     * Store a single message (replace if same ID exists)
     */
    storeMessage(message: Message): Promise<void>;

    /**
     * Store multiple messages
     */
    storeMessages(messages: Message[]): Promise<void>;
}

export interface MessageStore extends MessageReader, MessageWriter {}
