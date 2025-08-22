import { MessageStore } from '../interfaces/message-store';
import { Message } from '../models/messages';

/**
 * Repository pattern implementation for message storage using dual stores.
 *
 * Combines a fast cached store with a persistent store to provide optimal
 * performance while ensuring data durability. The cached store serves as a
 * first-level cache for recent messages, while the persistent store maintains
 * the complete message history.
 *
 * Storage Strategy:
 * - All writes go to both stores for consistency
 * - Reads try cached store first, fall back to persistent store
 * - Message history intelligently combines both stores
 */
export class MessageRepository implements MessageStore {
    private readonly cachedStore: MessageStore;
    private readonly persistentStore: MessageStore;

    /**
     * Creates a new MessageRepository instance.
     *
     * @param cachedStore - Fast in-memory store for recent messages
     * @param persistentStore - Durable store for complete message history
     */
    constructor(cachedStore: MessageStore, persistentStore: MessageStore) {
        this.cachedStore = cachedStore;
        this.persistentStore = persistentStore;
    }

    /**
     * Store a single message (replace if same ID exists).
     *
     * Writes to both cached and persistent stores to ensure consistency
     * and availability across both storage layers.
     *
     * @param message - The message to store
     * @returns Promise<void> Resolves when the message is stored in both stores
     */
    async storeMessage(message: Message): Promise<void> {
        // Store in both stores for consistency
        await Promise.all([
            this.cachedStore.storeMessage(message),
            this.persistentStore.storeMessage(message),
        ]);
    }

    /**
     * Store multiple messages.
     *
     * Writes all messages to both stores in parallel for optimal performance.
     *
     * @param messages - Array of messages to store
     * @returns Promise<void> Resolves when all messages are stored
     */
    async storeMessages(messages: Message[]): Promise<void> {
        // Store in both stores for consistency
        await Promise.all([
            this.cachedStore.storeMessages(messages),
            this.persistentStore.storeMessages(messages),
        ]);
    }

    /**
     * Get message history with intelligent caching and fallback.
     *
     * Strategy:
     * 1. If no limit specified, get from persistent store (complete history)
     * 2. If limit specified, try cached store first
     * 3. If cached doesn't have enough and no summary boundary, supplement from persistent
     * 4. Respect summary boundaries - if a summary is found, don't look beyond it
     *
     * @param limit - Maximum number of messages to return
     * @returns Promise<Message[]> Array of messages in chronological order
     */
    async getMessageHistory(limit?: number): Promise<Message[]> {
        // If no limit specified, get complete history from persistent store
        if (!limit) {
            return this.persistentStore.getMessageHistory();
        }

        // Get messages from cached store first
        const cachedMessages = await this.cachedStore.getMessageHistory(limit);

        // If we got enough messages from cache, return cache result
        if (cachedMessages.length >= limit) {
            return cachedMessages;
        }

        // If the last message in cache is a summary, we hit a boundary - don't look further
        // (the summary represents the messages that would come after it chronologically)
        if (
            cachedMessages.length > 0 &&
            cachedMessages[cachedMessages.length - 1]?.type === 'summary'
        ) {
            return cachedMessages;
        }

        // Need more messages and no summary boundary, get from persistent store
        // Get the full limit from persistent store and let it handle summary boundaries
        return this.persistentStore.getMessageHistory(limit);
    }

    /**
     * Get messages by type with intelligent caching and fallback.
     *
     * Strategy:
     * 1. If no limit specified, use persistent store for complete results
     * 2. If limit specified, try cached store first for performance
     * 3. If cache has enough results, return cache result
     * 4. If cache doesn't have enough, fall back to persistent store
     *
     * @param type - The message type to filter by
     * @param limit - Maximum number of messages to return
     * @returns Promise<Message[]> Array of messages matching the type
     */
    async getMessagesByType(
        type: Message['type'],
        limit?: number
    ): Promise<Message[]> {
        // If no limit specified, get complete results from persistent store
        if (!limit) {
            return this.persistentStore.getMessagesByType(type);
        }

        // Try cached store first for performance
        const cachedResults = await this.cachedStore.getMessagesByType(
            type,
            limit
        );

        // If cache has enough results, return cache result
        if (cachedResults.length >= limit) {
            return cachedResults;
        }

        // Cache doesn't have enough, fall back to persistent store
        return this.persistentStore.getMessagesByType(type, limit);
    }

    /**
     * Search messages by regex pattern with intelligent caching and fallback.
     *
     * Strategy:
     * 1. If no limit specified, use persistent store for complete search results
     * 2. If limit specified, try cached store first for performance
     * 3. If cache has enough results, return cache result
     * 4. If cache doesn't have enough, fall back to persistent store
     *
     * @param pattern - Regular expression pattern to search for
     * @param limit - Maximum number of messages to return
     * @param type - Optional message type to filter by
     * @returns Promise<Message[]> Array of matching messages
     */
    async searchByRegex(
        pattern: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]> {
        // If no limit specified, get complete search results from persistent store
        if (!limit) {
            return this.persistentStore.searchByRegex(pattern, undefined, type);
        }

        // Try cached store first for performance
        const cachedResults = await this.cachedStore.searchByRegex(
            pattern,
            limit,
            type
        );

        // If cache has enough results, return cache result
        if (cachedResults.length >= limit) {
            return cachedResults;
        }

        // Cache doesn't have enough, fall back to persistent store
        return this.persistentStore.searchByRegex(pattern, limit, type);
    }

    /**
     * Get message by ID.
     *
     * Tries cached store first for performance, falls back to persistent store.
     *
     * @param messageId - The ID of the message to retrieve
     * @returns Promise<Message | null> The message if found, null otherwise
     */
    async getMessageById(messageId: string): Promise<Message | null> {
        // Try cached store first for performance
        const cachedMessage = await this.cachedStore.getMessageById(messageId);
        if (cachedMessage) {
            return cachedMessage;
        }

        // Fall back to persistent store
        return this.persistentStore.getMessageById(messageId);
    }
}
