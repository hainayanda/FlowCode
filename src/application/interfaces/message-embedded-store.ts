import { DomainMessage } from '../../presentation/view-models/console/console-use-case.js';

/**
 * Ranked search result with relevance score
 */
export interface RankedMessage {
  message: DomainMessage;
  relevanceScore: number;
}

/**
 * Message vector reader interface for semantic search
 */
export interface MessageVectorReader {
  /**
   * Search messages by natural language query
   * Returns ranked results sorted by time (newest first) within relevance groups
   */
  searchByNaturalLanguage(query: string, limit?: number): Promise<RankedMessage[]>;
  
  /**
   * Get semantically similar messages to a given message
   */
  getSimilarMessages(messageId: string, limit?: number): Promise<RankedMessage[]>;
  
  /**
   * Check if vector search is available (based on config)
   */
  isVectorSearchAvailable(): Promise<boolean>;
}

/**
 * Message vector writer interface for managing embeddings
 */
export interface MessageVectorWriter {
  /**
   * Store message with vector embedding
   */
  storeMessageWithEmbedding(message: DomainMessage): Promise<void>;
  
  /**
   * Update message embedding
   */
  updateMessageEmbedding(messageId: string, message: DomainMessage): Promise<void>;
  
  /**
   * Remove message from vector store
   */
  removeMessageEmbedding(messageId: string): Promise<void>;
  
  /**
   * Clear all embeddings
   */
  clearAllEmbeddings(): Promise<void>;
  
  /**
   * Rebuild embeddings for all messages (maintenance operation)
   */
  rebuildEmbeddings(messages: DomainMessage[]): Promise<void>;

  /**
   * Check if embedding is enabled
   */
  isEmbeddingEnabled(): Promise<boolean>;
}