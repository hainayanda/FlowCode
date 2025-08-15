import { MessageVectorReader, MessageVectorWriter, RankedMessage } from '../../interfaces/message-embedded-store.js';
import { MessageReader } from '../../interfaces/message-store.js';
import { EmbeddingService } from '../../interfaces/embedding-service.js';
import { VectorStore, VectorResult } from '../../interfaces/vector-store.js';
import { DomainMessage, BaseDomainMessage } from '../../../presentation/view-models/console/console-use-case.js';

/**
 * Repository that orchestrates vector storage and embedding generation
 * Implements the MessageVectorReader and MessageVectorWriter interfaces
 * Following SOLID principles with dependency injection
 */
export class MessageVectorRepository implements MessageVectorReader, MessageVectorWriter {
  // Private properties
  private initialized = false;

  constructor(
    private vectorStore: VectorStore,
    private embeddingService: EmbeddingService,
    private messageStore: MessageReader
  ) {}

  // Public methods

  /**
   * Search messages by natural language query
   * Returns ranked results sorted by time (newest first) within relevance groups
   */
  async searchByNaturalLanguage(query: string, limit = 10): Promise<RankedMessage[]> {
    await this.ensureInitialized();
    
    if (!await this.embeddingService.isAvailable()) {
      return [];
    }

    try {
      // Generate embedding for the query
      const queryVector = await this.embeddingService.generateEmbedding(query);
      
      // Search similar vectors
      const vectorResults = await this.vectorStore.searchSimilar(queryVector, limit);
      
      // Convert to ranked messages
      return await this.convertVectorResultsToRankedMessages(vectorResults);
    } catch (error) {
      console.warn('Vector search failed, falling back to empty results:', error);
      return [];
    }
  }

  /**
   * Get semantically similar messages to a given message
   */
  async getSimilarMessages(messageId: string, limit = 10): Promise<RankedMessage[]> {
    await this.ensureInitialized();
    
    if (!await this.embeddingService.isAvailable()) {
      return [];
    }

    try {
      // Get the original message to generate its embedding
      const originalMessage = await this.messageStore.getMessageById(messageId);
      if (!originalMessage) {
        return [];
      }

      // Generate embedding for the message content
      const messageText = this.extractTextFromMessage(originalMessage);
      const queryVector = await this.embeddingService.generateEmbedding(messageText);
      
      // Search similar vectors (exclude the original message)
      const vectorResults = await this.vectorStore.searchSimilar(queryVector, limit + 1);
      const filteredResults = vectorResults.filter(result => result.id !== messageId);
      
      // Convert to ranked messages
      return await this.convertVectorResultsToRankedMessages(filteredResults.slice(0, limit));
    } catch (error) {
      console.warn('Similar message search failed:', error);
      return [];
    }
  }

  /**
   * Check if vector search is available (based on config)
   */
  async isVectorSearchAvailable(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return await this.embeddingService.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Store message with vector embedding
   */
  async storeMessageWithEmbedding(message: DomainMessage): Promise<void> {
    await this.ensureInitialized();
    
    if (!await this.embeddingService.isAvailable()) {
      // Silently skip if embedding is not available
      return;
    }

    try {
      const messageText = this.extractTextFromMessage(message);
      const embedding = await this.embeddingService.generateEmbedding(messageText);
      
      const metadata = {
        messageId: message.id,
        type: message.type,
        timestamp: message.timestamp,
        content: messageText
      };
      
      await this.vectorStore.storeVector(message.id, embedding, metadata);
    } catch (error) {
      // Log but don't fail - the message store should still work
      console.warn('Failed to store message embedding:', error);
    }
  }

  /**
   * Update message embedding
   */
  async updateMessageEmbedding(messageId: string, message: DomainMessage): Promise<void> {
    await this.ensureInitialized();
    
    if (!await this.embeddingService.isAvailable()) {
      return;
    }

    try {
      const messageText = this.extractTextFromMessage(message);
      const embedding = await this.embeddingService.generateEmbedding(messageText);
      
      const metadata = {
        messageId: message.id,
        type: message.type,
        timestamp: message.timestamp,
        content: messageText
      };
      
      await this.vectorStore.updateVector(messageId, embedding, metadata);
    } catch (error) {
      console.warn('Failed to update message embedding:', error);
    }
  }

  /**
   * Remove message from vector store
   */
  async removeMessageEmbedding(messageId: string): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.vectorStore.removeVector(messageId);
    } catch (error) {
      console.warn('Failed to remove message embedding:', error);
    }
  }

  /**
   * Clear all embeddings
   */
  async clearAllEmbeddings(): Promise<void> {
    await this.ensureInitialized();
    
    try {
      await this.vectorStore.clearAll();
    } catch (error) {
      console.warn('Failed to clear all embeddings:', error);
    }
  }

  /**
   * Rebuild embeddings for all messages (maintenance operation)
   */
  async rebuildEmbeddings(messages: DomainMessage[]): Promise<void> {
    await this.ensureInitialized();
    
    if (!await this.embeddingService.isAvailable()) {
      return;
    }

    try {
      // Clear existing embeddings
      await this.vectorStore.clearAll();
      
      // Store embeddings for all messages
      for (const message of messages) {
        await this.storeMessageWithEmbedding(message);
      }
    } catch (error) {
      console.warn('Failed to rebuild embeddings:', error);
    }
  }

  /**
   * Check if embedding is enabled
   */
  async isEmbeddingEnabled(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return await this.embeddingService.isAvailable();
    } catch {
      return false;
    }
  }

  // Private methods
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.vectorStore.initialize();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize message vector repository: ${error}`);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private extractTextFromMessage(message: DomainMessage): string {
    // Extract meaningful text content from the message
    switch (message.type) {
      case 'user-input':
      case 'system':
        return message.content || '';
      case 'ai-response':
      case 'ai-thinking':
        return `${message.metadata.workerId}: ${message.content || ''}`;
      case 'error':
        return `Error: ${message.content || ''}`;
      case 'file-operation':
        return `${message.metadata.fileOperation} ${message.metadata.filePath}: ${message.content || ''}`;
      case 'user-choice':
        return `${message.metadata.prompt}: ${message.content || ''}`;
      default:
        // This should never happen with proper typing, but handle gracefully
        return (message as BaseDomainMessage).content || '';
    }
  }

  private async convertVectorResultsToRankedMessages(vectorResults: VectorResult[]): Promise<RankedMessage[]> {
    const rankedMessages: RankedMessage[] = [];
    
    for (const result of vectorResults) {
      const message = await this.messageStore.getMessageById(result.id);
      if (message) {
        rankedMessages.push({
          message,
          relevanceScore: 1 - result.distance // Convert distance to relevance score
        });
      }
    }
    
    // Sort by relevance score (highest first), then by timestamp (newest first)
    return rankedMessages.sort((a, b) => {
      if (Math.abs(a.relevanceScore - b.relevanceScore) > 0.01) {
        return b.relevanceScore - a.relevanceScore;
      }
      return new Date(b.message.timestamp).getTime() - new Date(a.message.timestamp).getTime();
    });
  }
}