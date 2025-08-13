import { Observable } from 'rxjs';
import { DomainMessage } from '../../presentation/view-models/console/console-use-case.js';

/**
 * Message reader interface for retrieving stored messages
 */
export interface MessageReader {

  /**
   * Get message history with optional limit
   */
  getMessageHistory(limit?: number): Promise<DomainMessage[]>;
  
  /**
   * Get messages by type
   */
  getMessagesByType(type: DomainMessage['type']): Promise<DomainMessage[]>;
  
  /**
   * Search messages by regex pattern with optional type filtering
   */
  searchByRegex(pattern: string, limit?: number, type?: DomainMessage['type']): Promise<DomainMessage[]>;
  
  /**
   * Get message by ID
   */
  getMessageById(messageId: string): Promise<DomainMessage | null>;
}

export interface MessagePublisher { 
  /**
   * Observable stream of current message history (emits on every store operation)
   * Contains all renderable messages sorted by timestamp
   */
  messageHistory$: Observable<DomainMessage[]>;
}

/**
 * Message writer interface for storing messages
 */
export interface MessageWriter {
  /**
   * Store a single message (replace if same ID exists)
   */
  storeMessage(message: DomainMessage): Promise<void>;
  
  /**
   * Store multiple messages
   */
  storeMessages(messages: DomainMessage[]): Promise<void>;
  
  /**
   * Update existing message by ID
   */
  updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void>;
  
  /**
   * Clear all message history
   */
  clearHistory(): Promise<void>;

}

export interface MessageStore extends MessageWriter, MessageReader {
  initialize(): Promise<void>;

  getAllMessages(): Promise<DomainMessage[]>;
}

export interface MessageStorePublisher extends MessageStore, MessagePublisher {
}