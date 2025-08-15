import { MessageVectorReader, RankedMessage } from '../../../src/application/interfaces/message-embedded-store.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';

/**
 * Mock implementation of MessageVectorReader for vector search testing
 */
export class MockMessageVectorReader implements MessageVectorReader {
  public mockRankedMessages: RankedMessage[] = [];
  public isAvailable = true;
  public shouldThrowError = false;

  // Tracking properties for test verification
  public lastNaturalLanguageQuery?: string;
  public lastNaturalLanguageLimit?: number;
  public lastSimilarMessageId?: string;
  public lastSimilarLimit?: number;
  public availabilityCheckCalled = false;

  async searchByNaturalLanguage(query: string, limit?: number): Promise<RankedMessage[]> {
    if (this.shouldThrowError) {
      throw new Error('Mock error in searchByNaturalLanguage');
    }

    this.lastNaturalLanguageQuery = query;
    this.lastNaturalLanguageLimit = limit;

    return this.mockRankedMessages.slice(0, limit);
  }

  async getSimilarMessages(messageId: string, limit?: number): Promise<RankedMessage[]> {
    if (this.shouldThrowError) {
      throw new Error('Mock error in getSimilarMessages');
    }

    this.lastSimilarMessageId = messageId;
    this.lastSimilarLimit = limit;

    return this.mockRankedMessages.slice(0, limit);
  }

  async isVectorSearchAvailable(): Promise<boolean> {
    if (this.shouldThrowError) {
      throw new Error('Mock error in isVectorSearchAvailable');
    }

    this.availabilityCheckCalled = true;
    return this.isAvailable;
  }
}

/**
 * Mock implementation of EmbeddingService for testing
 */
export class MockEmbeddingService implements EmbeddingService {
  public shouldThrowError = false;
  public mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
  public isServiceAvailable = true;
  public embeddingDimension = 1536;

  // Tracking properties for test verification
  public lastText?: string;
  public generateEmbeddingCalled = false;
  public isAvailableCalled = false;

  async generateEmbedding(text: string): Promise<number[]> {
    if (this.shouldThrowError) {
      throw new Error('Mock error in generateEmbedding');
    }

    this.generateEmbeddingCalled = true;
    this.lastText = text;
    return [...this.mockEmbedding];
  }

  async isAvailable(): Promise<boolean> {
    if (this.shouldThrowError) {
      throw new Error('Mock error in isAvailable');
    }

    this.isAvailableCalled = true;
    return this.isServiceAvailable;
  }

  getEmbeddingDimension(): number {
    return this.embeddingDimension;
  }
}