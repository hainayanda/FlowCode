import { BehaviorSubject, Observable } from 'rxjs';
import { MessageStorePublisher } from '../../interfaces/message-store.js';
import { DomainMessage } from '../../../presentation/view-models/console/console-use-case.js';

/**
 * In-memory message store implementation using array-based storage
 * Implements all message store interfaces for complete functionality
 */
export class InMemoryMessageStore implements MessageStorePublisher {
  private messages: DomainMessage[] = [];
  private messageHistorySubject = new BehaviorSubject<DomainMessage[]>([]);

  /**
   * Observable stream of current message history
   */
  get messageHistory$(): Observable<DomainMessage[]> {
    return this.messageHistorySubject.asObservable();
  }

  /**
   * Get message history with optional limit
   */
  async getMessageHistory(limit?: number): Promise<DomainMessage[]> {
    const sorted = this.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return limit ? sorted.slice(-limit) : sorted;
  }

  /**
   * Get messages by type
   */
  async getMessagesByType(type: DomainMessage['type']): Promise<DomainMessage[]> {
    return this.messages
      .filter(msg => msg.type === type)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Search messages by regex pattern with optional type filtering
   */
  async searchByRegex(pattern: string, limit?: number, type?: DomainMessage['type']): Promise<DomainMessage[]> {
    const regex = new RegExp(pattern, 'i');
    const matches = this.messages
      .filter(msg => regex.test(msg.content))
      .filter(msg => !type || msg.type === type)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return limit ? matches.slice(-limit) : matches;
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: string): Promise<DomainMessage | null> {
    return this.messages.find(msg => msg.id === messageId) || null;
  }

  /**
   * Store a single message (replace if same ID exists)
   */
  async storeMessage(message: DomainMessage): Promise<void> {
    const existingIndex = this.messages.findIndex(msg => msg.id === message.id);
    
    if (existingIndex >= 0) {
      this.messages[existingIndex] = message;
    } else {
      this.messages.push(message);
    }

    this.emitUpdatedHistory();
  }

  /**
   * Store multiple messages
   */
  async storeMessages(messages: DomainMessage[]): Promise<void> {
    for (const message of messages) {
      const existingIndex = this.messages.findIndex(msg => msg.id === message.id);
      
      if (existingIndex >= 0) {
        this.messages[existingIndex] = message;
      } else {
        this.messages.push(message);
      }
    }

    this.emitUpdatedHistory();
  }

  /**
   * Update existing message by ID
   */
  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {
    const existingIndex = this.messages.findIndex(msg => msg.id === messageId);
    
    if (existingIndex >= 0) {
      const existing = this.messages[existingIndex];
      this.messages[existingIndex] = Object.assign({}, existing, updates) as DomainMessage;
      this.emitUpdatedHistory();
    }
  }

  /**
   * Initialize the store (no-op for in-memory implementation)
   */
  async initialize(): Promise<void> {
    // No initialization needed for in-memory store
  }

  /**
   * Clear all message history
   */
  async clearHistory(): Promise<void> {
    this.messages = [];
    this.emitUpdatedHistory();
  }

  /**
   * Get all messages
   */
  async getAllMessages(): Promise<DomainMessage[]> {
    return [...this.messages];
  }

  private emitUpdatedHistory(): void {
    const sorted = this.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.messageHistorySubject.next([...sorted]);
  }
}