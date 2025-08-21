import { Embedder } from '../../../src/application/interfaces/embedder';
import { MessageStore } from '../../../src/application/interfaces/message-store';
import { VectorStore } from '../../../src/application/interfaces/vector-store';
import { Message } from '../../../src/application/models/messages';
import { VectorSearchResult } from '../../../src/application/models/sqlite-message';

/**
 * Mock Embedder for testing
 */
export class MockEmbedder implements Embedder {
    private _isAvailable: boolean;
    private embeddings: Map<string, number[]> = new Map();

    constructor(isAvailable: boolean = true) {
        this._isAvailable = isAvailable;
        // Set up some predictable embeddings for testing
        this.embeddings.set('test message', [0.1, 0.2, 0.3]);
        this.embeddings.set('similar content', [0.1, 0.2, 0.4]);
        this.embeddings.set('different text', [0.9, 0.8, 0.7]);
        this.embeddings.set('hello world', [0.5, 0.5, 0.5]);
    }

    get isAvailable(): boolean {
        return this._isAvailable;
    }

    setAvailable(available: boolean): void {
        this._isAvailable = available;
    }

    async embed(text: string): Promise<number[]> {
        if (!this._isAvailable) {
            throw new Error('Embedder is not available');
        }

        // Return predefined embedding or generate a simple one based on text
        if (this.embeddings.has(text)) {
            return this.embeddings.get(text)!;
        }

        // Generate a simple embedding based on text length and characters
        const vector = [
            text.length * 0.01,
            text.charCodeAt(0) * 0.001,
            text.split(' ').length * 0.1,
        ];
        this.embeddings.set(text, vector);
        return vector;
    }

    addEmbedding(text: string, vector: number[]): void {
        this.embeddings.set(text, vector);
    }
}

/**
 * Mock VectorStore for testing
 */
export class MockVectorStore implements VectorStore {
    private vectors: Map<string, { vector: number[]; messageId: string }> =
        new Map();
    private idCounter = 1;

    async storeVector(vector: number[], messageId: string): Promise<void> {
        const id = `vector-${this.idCounter++}`;
        this.vectors.set(id, { vector, messageId });
    }

    async searchSimilar(
        vector: number[],
        limit: number = 10
    ): Promise<VectorSearchResult[]> {
        const results: VectorSearchResult[] = [];

        for (const [id, stored] of this.vectors) {
            const similarity = this.calculateSimilarity(vector, stored.vector);
            results.push({
                id,
                messageId: stored.messageId,
                vector: stored.vector,
                similarity,
            });
        }

        // Sort by similarity (highest first) and apply limit
        return results
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    private calculateSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    getStoredVectors(): Map<string, { vector: number[]; messageId: string }> {
        return new Map(this.vectors);
    }

    clear(): void {
        this.vectors.clear();
        this.idCounter = 1;
    }
}

/**
 * Mock MessageStore for testing
 */
export class MockMessageStore implements MessageStore {
    private messages: Map<string, Message> = new Map();

    async storeMessage(message: Message): Promise<void> {
        this.messages.set(message.id, { ...message });
    }

    async storeMessages(messages: Message[]): Promise<void> {
        for (const message of messages) {
            await this.storeMessage(message);
        }
    }

    async getMessageHistory(limit?: number): Promise<Message[]> {
        const allMessages = Array.from(this.messages.values()).sort(
            (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );

        if (limit !== undefined) {
            return allMessages.slice(-limit);
        }
        return allMessages;
    }

    async getMessagesByType(
        type: Message['type'],
        limit?: number
    ): Promise<Message[]> {
        const typeMessages = Array.from(this.messages.values())
            .filter((msg) => msg.type === type)
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        if (limit !== undefined) {
            return typeMessages.slice(-limit);
        }
        return typeMessages;
    }

    async searchByRegex(
        pattern: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]> {
        const regex = new RegExp(pattern, 'i');
        let matchingMessages = Array.from(this.messages.values())
            .filter((msg) => {
                const typeMatch = !type || msg.type === type;
                const contentMatch = regex.test(msg.content);
                return typeMatch && contentMatch;
            })
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        if (limit !== undefined) {
            matchingMessages = matchingMessages.slice(-limit);
        }
        return matchingMessages;
    }

    async getMessageById(messageId: string): Promise<Message | null> {
        return this.messages.get(messageId) || null;
    }

    getStoredMessages(): Map<string, Message> {
        return new Map(this.messages);
    }

    clear(): void {
        this.messages.clear();
    }
}
