import { Message } from '../models/messages';

/**
 * Interface for reading messages from storage.
 * Provides various methods to query and retrieve stored conversation messages.
 */
export interface MessageReader {
    /**
     * Retrieves message history in chronological order.
     * May apply summary boundary logic depending on implementation.
     *
     * @param limit - Maximum number of messages to return (optional)
     * @returns Promise resolving to array of messages ordered by timestamp
     */
    getMessageHistory(limit?: number): Promise<Message[]>;

    /**
     * Retrieves messages filtered by type (user, agent, error, etc.).
     * Results are ordered chronologically.
     *
     * @param type - The message type to filter by
     * @param limit - Maximum number of messages to return (optional)
     * @returns Promise resolving to array of messages of the specified type
     */
    getMessagesByType(
        type: Message['type'],
        limit?: number
    ): Promise<Message[]>;

    /**
     * Searches messages using regular expression pattern matching on content.
     * Supports case-insensitive search with optional type filtering.
     *
     * @param pattern - Regular expression pattern to match against message content
     * @param limit - Maximum number of results to return (optional)
     * @param type - Optional message type filter
     * @returns Promise resolving to array of matching messages
     */
    searchByRegex(
        pattern: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]>;

    /**
     * Retrieves a specific message by its unique identifier.
     *
     * @param messageId - Unique identifier of the message to retrieve
     * @returns Promise resolving to the message if found, null otherwise
     */
    getMessageById(messageId: string): Promise<Message | null>;
}

/**
 * Interface for writing messages to storage.
 * Handles persistence of conversation messages with support for updates and batch operations.
 */
export interface MessageWriter {
    /**
     * Stores a single message, replacing any existing message with the same ID.
     * This supports the streaming/chunking pattern where messages can be updated over time.
     *
     * @param message - The message to store
     * @throws Error if storage operation fails
     */
    storeMessage(message: Message): Promise<void>;

    /**
     * Stores multiple messages in a batch operation.
     * More efficient than individual storeMessage calls for bulk operations.
     *
     * @param messages - Array of messages to store
     * @throws Error if any storage operation fails
     */
    storeMessages(messages: Message[]): Promise<void>;
}

/**
 * Combined interface for message storage operations.
 * Provides both read and write capabilities for conversation message persistence.
 */
export interface MessageStore extends MessageReader, MessageWriter {}

/**
 * Extended message reader interface that adds natural language search capabilities.
 * Inherits all basic message reading functionality and adds semantic search.
 */
export interface NaturalMessageReader extends MessageReader {
    /**
     * Searches for messages similar to the provided text using semantic similarity.
     * Typically implemented using vector embeddings and similarity metrics.
     *
     * @param message - The text to search for similar messages
     * @param limit - Maximum number of results to return (optional)
     * @param type - Optional message type filter
     * @returns Promise resolving to array of similar messages ordered by relevance
     */
    searchSimilar(
        message: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]>;
}

/**
 * Combined interface for natural language message storage operations.
 * Provides semantic search capabilities along with standard message storage.
 * Useful for implementations that support AI-powered message retrieval.
 */
export interface NaturalMessageStore
    extends NaturalMessageReader,
        MessageWriter {}
