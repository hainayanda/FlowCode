import { Embedder } from '../../common/interfaces/embedder';
import { MessageStore, NaturalMessageStore } from './interfaces/message-store';
import { VectorStore } from './interfaces/vector-store';
import { Message } from './models/messages';

/**
 * Repository that combines vector search capabilities with message storage.
 * Uses Embedder for text-to-vector conversion, VectorStore for similarity search,
 * and MessageStore for message persistence.
 */
export class NaturalMessageRepository implements NaturalMessageStore {
    private embedder: Embedder;
    private vectorStore: VectorStore;
    private messageStore: MessageStore;

    /**
     * Creates a new NaturalMessageRepository instance.
     * @param embedder - Embedder for converting text to vectors (optional)
     * @param vectorStore - Store for vector operations
     * @param messageStore - Store for message operations
     */
    constructor(
        embedder: Embedder,
        vectorStore: VectorStore,
        messageStore: MessageStore
    ) {
        this.embedder = embedder;
        this.vectorStore = vectorStore;
        this.messageStore = messageStore;
    }

    /**
     * Whether vector search is available based on embedder availability.
     */
    get isVectorSearchAvailable(): boolean {
        return this.embedder.isAvailable;
    }

    /**
     * Searches for similar messages using vector similarity.
     * If Embedder is not available, falls back to empty results.
     *
     * @param message - The message text to search for
     * @param limit - Maximum number of results to return
     * @param type - Optional message type filter
     * @returns Promise resolving to array of similar messages
     */
    async searchSimilar(
        message: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]> {
        if (!this.isVectorSearchAvailable) {
            return [];
        }

        try {
            const vector = await this.embedder.embed(message);
            const vectorResults = await this.vectorStore.searchSimilar(
                vector,
                limit
            );

            const messages: Message[] = [];
            for (const result of vectorResults) {
                const msg = await this.messageStore.getMessageById(
                    result.messageId
                );
                if (msg && (!type || msg.type === type)) {
                    messages.push(msg);
                }
            }

            return messages;
        } catch (error) {
            throw new Error(`Vector search failed: ${error}`);
        }
    }

    /**
     * Stores a message with optional vector embedding.
     * If Embedder is available, also stores the vector for similarity search.
     *
     * @param message - The message to store
     */
    async storeMessage(message: Message): Promise<void> {
        await this.messageStore.storeMessage(message);

        if (this.isVectorSearchAvailable) {
            try {
                const vector = await this.embedder.embed(message.content);
                await this.vectorStore.storeVector(vector, message.id);
            } catch (error) {
                throw new Error(`Vector storage failed: ${error}`);
            }
        }
    }

    /**
     * Stores multiple messages with optional vector embeddings.
     *
     * @param messages - The messages to store
     */
    async storeMessages(messages: Message[]): Promise<void> {
        await this.messageStore.storeMessages(messages);

        if (this.isVectorSearchAvailable) {
            for (const message of messages) {
                try {
                    const vector = await this.embedder!.embed(message.content);
                    await this.vectorStore.storeVector(vector, message.id);
                } catch (error) {
                    throw new Error(
                        `Vector storage failed for message ${message.id}: ${error}`
                    );
                }
            }
        }
    }

    /**
     * Get message history with optional limit.
     */
    async getMessageHistory(limit?: number): Promise<Message[]> {
        return this.messageStore.getMessageHistory(limit);
    }

    /**
     * Get messages by type.
     */
    async getMessagesByType(
        type: Message['type'],
        limit?: number
    ): Promise<Message[]> {
        return this.messageStore.getMessagesByType(type, limit);
    }

    /**
     * Search messages by regex pattern with optional type filtering.
     */
    async searchByRegex(
        pattern: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]> {
        return this.messageStore.searchByRegex(pattern, limit, type);
    }

    /**
     * Get message by ID.
     */
    async getMessageById(messageId: string): Promise<Message | null> {
        return this.messageStore.getMessageById(messageId);
    }
}
