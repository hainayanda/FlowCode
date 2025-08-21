import { VectorStore } from '../../../../src/application/interfaces/vector-store';
import { VectorSearchResult } from '../../../../src/application/models/sqlite-message';

/**
 * Mock VectorStore implementation for testing VectorRepository
 */
export class MockVectorStore implements VectorStore {
    private vectors: Map<string, { vector: number[]; messageId: string }> =
        new Map();
    private storeCalls: Array<{ vector: number[]; messageId: string }> = [];
    private searchCalls: Array<{ vector: number[]; limit: number }> = [];
    private shouldThrowOnStore = false;
    private shouldThrowOnSearch = false;
    private storeDelay = 0;
    private searchDelay = 0;

    async storeVector(vector: number[], messageId: string): Promise<void> {
        this.storeCalls.push({ vector: [...vector], messageId });

        if (this.shouldThrowOnStore) {
            throw new Error('Mock store error');
        }

        if (this.storeDelay > 0) {
            await new Promise((resolve) =>
                setTimeout(resolve, this.storeDelay)
            );
        }

        this.vectors.set(messageId, { vector: [...vector], messageId });
    }

    async searchSimilar(
        vector: number[],
        limit: number = 10
    ): Promise<VectorSearchResult[]> {
        this.searchCalls.push({ vector: [...vector], limit });

        if (this.shouldThrowOnSearch) {
            throw new Error('Mock search error');
        }

        if (this.searchDelay > 0) {
            await new Promise((resolve) =>
                setTimeout(resolve, this.searchDelay)
            );
        }

        const results: VectorSearchResult[] = [];

        for (const [messageId, stored] of this.vectors) {
            const similarity = this.calculateCosineSimilarity(
                vector,
                stored.vector
            );
            results.push({
                id: `vector-${messageId}`,
                messageId,
                vector: [...stored.vector],
                similarity,
            });
        }

        // Sort by similarity descending and apply limit
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit);
    }

    // Helper methods for testing
    getStoreCalls(): Array<{ vector: number[]; messageId: string }> {
        return [...this.storeCalls];
    }

    getSearchCalls(): Array<{ vector: number[]; limit: number }> {
        return [...this.searchCalls];
    }

    getStoredVectors(): Map<string, { vector: number[]; messageId: string }> {
        return new Map(this.vectors);
    }

    setVectors(
        vectors: Map<string, { vector: number[]; messageId: string }>
    ): void {
        this.vectors = new Map(vectors);
    }

    setShouldThrowOnStore(shouldThrow: boolean): void {
        this.shouldThrowOnStore = shouldThrow;
    }

    setShouldThrowOnSearch(shouldThrow: boolean): void {
        this.shouldThrowOnSearch = shouldThrow;
    }

    setStoreDelay(delay: number): void {
        this.storeDelay = delay;
    }

    setSearchDelay(delay: number): void {
        this.searchDelay = delay;
    }

    clearCalls(): void {
        this.storeCalls = [];
        this.searchCalls = [];
    }

    clear(): void {
        this.vectors.clear();
        this.clearCalls();
    }

    private calculateCosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
