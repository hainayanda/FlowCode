import { MessageReader } from '../../../src/application/interfaces/message-store.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

/**
 * Mock implementation of MessageReader for SQL search testing
 */
export class MockMessageReader implements MessageReader {
  public mockMessages: DomainMessage[] = [];
  public shouldThrowError = false;

  // Tracking properties for test verification
  public lastSearchPattern?: string;
  public lastSearchLimit?: number;
  public lastSearchType?: DomainMessage['type'];
  public lastHistoryLimit?: number;
  public lastTypeFilter?: DomainMessage['type'];
  public lastMessageId?: string;

  async getMessageHistory(limit?: number): Promise<DomainMessage[]> {
    if (this.shouldThrowError) {
      throw new Error('Mock error in getMessageHistory');
    }

    this.lastHistoryLimit = limit;
    return this.mockMessages.slice(0, limit);
  }

  async getMessagesByType(type: DomainMessage['type']): Promise<DomainMessage[]> {
    if (this.shouldThrowError) {
      throw new Error('Mock error in getMessagesByType');
    }

    this.lastTypeFilter = type;
    return this.mockMessages.filter(msg => msg.type === type);
  }

  async searchByRegex(
    pattern: string, 
    limit?: number, 
    type?: DomainMessage['type']
  ): Promise<DomainMessage[]> {
    if (this.shouldThrowError) {
      throw new Error('Mock error in searchByRegex');
    }

    this.lastSearchPattern = pattern;
    this.lastSearchLimit = limit;
    this.lastSearchType = type;

    let filteredMessages = this.mockMessages;
    
    if (type) {
      filteredMessages = filteredMessages.filter(msg => msg.type === type);
    }

    // Simple mock regex filtering
    const regex = new RegExp(pattern, 'i');
    filteredMessages = filteredMessages.filter(msg => {
      const contentMatch = regex.test(msg.content);
      // Check workerId in metadata for AI messages
      const workerIdMatch = 'metadata' in msg && msg.metadata && 'workerId' in msg.metadata 
        ? regex.test(msg.metadata.workerId) 
        : false;
      return contentMatch || workerIdMatch;
    });

    return filteredMessages.slice(0, limit);
  }

  async getMessageById(messageId: string): Promise<DomainMessage | null> {
    if (this.shouldThrowError) {
      throw new Error('Mock error in getMessageById');
    }

    this.lastMessageId = messageId;
    return this.mockMessages.find(msg => msg.id === messageId) || null;
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