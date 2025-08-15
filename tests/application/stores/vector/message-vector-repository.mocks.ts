import { EmbeddingService } from '../../../../src/application/interfaces/embedding-service.js';
import { MessageReader } from '../../../../src/application/interfaces/message-store.js';
import { VectorStore, VectorResult } from '../../../../src/application/interfaces/vector-store.js';
import { DomainMessage } from '../../../../src/presentation/view-models/console/console-use-case.js';

/**
 * Mock EmbeddingService implementation for testing
 */
export class MockEmbeddingService implements EmbeddingService {
  isAvailableValue = true;
  embeddings = new Map<string, number[]>();
  dimension = 384; // Default dimension
  
  // Operation tracking
  generateEmbeddingCalls: string[] = [];
  isAvailableCalls = 0;

  async generateEmbedding(text: string): Promise<number[]> {
    this.generateEmbeddingCalls.push(text);
    
    // Return cached embedding if available
    if (this.embeddings.has(text)) {
      return [...this.embeddings.get(text)!];
    }
    
    // Generate deterministic embedding based on text
    const hash = this.simpleHash(text);
    const vector = Array(this.dimension).fill(0).map((_, i) => 
      Math.sin(hash + i) * 0.5 + 0.5
    );
    
    this.embeddings.set(text, vector);
    return [...vector];
  }

  async isAvailable(): Promise<boolean> {
    this.isAvailableCalls++;
    return this.isAvailableValue;
  }

  getEmbeddingDimension(): number {
    return this.dimension;
  }

  // Test helper methods
  setAvailable(available: boolean): void {
    this.isAvailableValue = available;
  }

  setEmbedding(text: string, vector: number[]): void {
    this.embeddings.set(text, [...vector]);
  }

  clearCallHistory(): void {
    this.generateEmbeddingCalls = [];
    this.isAvailableCalls = 0;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }
}

/**
 * Mock MessageReader implementation for testing
 */
export class MockMessageReader implements MessageReader {
  messages = new Map<string, DomainMessage>();
  
  // Operation tracking
  getMessageByIdCalls: string[] = [];
  getMessageHistoryCalls: Array<{ limit?: number }> = [];
  getMessagesByTypeCalls: Array<{ type: DomainMessage['type'] }> = [];
  searchByRegexCalls: Array<{ pattern: string, limit?: number, type?: DomainMessage['type'] }> = [];

  async getMessageHistory(limit?: number): Promise<DomainMessage[]> {
    this.getMessageHistoryCalls.push({ limit });
    const allMessages = Array.from(this.messages.values());
    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return limit ? allMessages.slice(0, limit) : allMessages;
  }

  async getMessagesByType(type: DomainMessage['type']): Promise<DomainMessage[]> {
    this.getMessagesByTypeCalls.push({ type });
    return Array.from(this.messages.values()).filter(m => m.type === type);
  }

  async searchByRegex(pattern: string, limit?: number, type?: DomainMessage['type']): Promise<DomainMessage[]> {
    this.searchByRegexCalls.push({ pattern, limit, type });
    const regex = new RegExp(pattern);
    const results = Array.from(this.messages.values()).filter(m => 
      regex.test(m.content) && (!type || m.type === type)
    );
    return limit ? results.slice(0, limit) : results;
  }

  async getMessageById(messageId: string): Promise<DomainMessage | null> {
    this.getMessageByIdCalls.push(messageId);
    return this.messages.get(messageId) || null;
  }

  // Test helper methods
  addMessage(message: DomainMessage): void {
    this.messages.set(message.id, { ...message });
  }

  clearMessages(): void {
    this.messages.clear();
  }

  clearCallHistory(): void {
    this.getMessageByIdCalls = [];
    this.getMessageHistoryCalls = [];
    this.getMessagesByTypeCalls = [];
    this.searchByRegexCalls = [];
  }
}

/**
 * Mock VectorStore implementation for testing
 */
export class MockVectorStore implements VectorStore {
  initializeCalled = false;
  vectors = new Map<string, { vector: number[], metadata: Record<string, any> }>();
  searchResults: VectorResult[] = [];
  
  // Operation tracking
  storeVectorCalls: Array<{ id: string, vector: number[], metadata: Record<string, any> }> = [];
  updateVectorCalls: Array<{ id: string, vector: number[], metadata: Record<string, any> }> = [];
  removeVectorCalls: string[] = [];
  searchSimilarCalls: Array<{ queryVector: number[], limit?: number }> = [];
  clearAllCalled = false;

  async initialize(): Promise<void> {
    this.initializeCalled = true;
  }

  async storeVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    this.storeVectorCalls.push({ id, vector: [...vector], metadata: { ...metadata } });
    this.vectors.set(id, { vector: [...vector], metadata: { ...metadata } });
  }

  async updateVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    this.updateVectorCalls.push({ id, vector: [...vector], metadata: { ...metadata } });
    this.vectors.set(id, { vector: [...vector], metadata: { ...metadata } });
  }

  async searchSimilar(queryVector: number[], limit?: number): Promise<VectorResult[]> {
    this.searchSimilarCalls.push({ queryVector: [...queryVector], limit });
    return [...this.searchResults];
  }

  async removeVector(id: string): Promise<void> {
    this.removeVectorCalls.push(id);
    this.vectors.delete(id);
  }

  async clearAll(): Promise<void> {
    this.clearAllCalled = true;
    this.vectors.clear();
  }

  async hasVector(id: string): Promise<boolean> {
    return this.vectors.has(id);
  }

  async getVectorCount(): Promise<number> {
    return this.vectors.size;
  }

  // Test helper methods
  setSearchResults(results: VectorResult[]): void {
    this.searchResults = results.map(r => ({ ...r, vector: [...r.vector], metadata: { ...r.metadata } }));
  }

  clearCallHistory(): void {
    this.storeVectorCalls = [];
    this.updateVectorCalls = [];
    this.removeVectorCalls = [];
    this.searchSimilarCalls = [];
    this.clearAllCalled = false;
  }
}

/**
 * Create test domain messages
 */
export function createTestMessage(
  id: string, 
  type: DomainMessage['type'], 
  content: string,
  additionalProps: Partial<DomainMessage> = {}
): DomainMessage {
  const baseMessage = {
    id,
    content,
    timestamp: new Date(),
    ...additionalProps
  };

  switch (type) {
    case 'user-input':
    case 'system':
      return { ...baseMessage, type } as DomainMessage;
    
    case 'ai-response':
    case 'ai-thinking':
      return {
        ...baseMessage,
        type,
        metadata: {
          workerId: 'test-worker',
          isStreaming: false,
          ...((additionalProps as any)?.metadata || {})
        }
      } as DomainMessage;
    
    case 'error':
      return {
        ...baseMessage,
        type,
        metadata: {
          errorCode: 'TEST_ERROR',
          recoverable: true,
          ...((additionalProps as any)?.metadata || {})
        }
      } as DomainMessage;
    
    case 'file-operation':
      return {
        ...baseMessage,
        type,
        metadata: {
          filePath: '/test/file.ts',
          fileOperation: 'edit' as const,
          ...((additionalProps as any)?.metadata || {})
        }
      } as DomainMessage;
    
    case 'user-choice':
      return {
        ...baseMessage,
        type,
        metadata: {
          choices: ['yes', 'no'],
          selectedIndex: 0,
          prompt: 'Test choice',
          ...((additionalProps as any)?.metadata || {})
        }
      } as DomainMessage;
    
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

/**
 * Create test vector result
 */
export function createTestVectorResult(
  id: string, 
  vector: number[], 
  metadata: Record<string, any>, 
  distance = 0
): VectorResult {
  return {
    id,
    vector: [...vector],
    metadata: { ...metadata },
    distance
  };
}