import { Observable } from 'rxjs';
import { MessageStorePublisher, MessageStore } from '../../interfaces/message-store.js';
import { DomainMessage } from '../../../presentation/view-models/console/console-use-case.js';

/**
 * Message repository that orchestrates both in-memory and persistent storage
 * Implements all message store interfaces and handles the dual-store architecture
 */
export class MessageRepository implements MessageStorePublisher {
  private inMemoryStore: MessageStorePublisher;
  private persistentStore: MessageStore;
  private initialized = false;

  constructor(inMemoryStore: MessageStorePublisher, persistentStore: MessageStore) {
    this.inMemoryStore = inMemoryStore;
    this.persistentStore = persistentStore;
  }

  /**
   * Initialize the repository by loading persistent messages into memory
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.inMemoryStore.initialize();
      await this.persistentStore.initialize();
      await this.loadPersistentToMemory();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize message repository: ${error}`);
    }
  }

  /**
   * Observable stream of current message history from in-memory store
   */
  get messageHistory$(): Observable<DomainMessage[]> {
    return this.inMemoryStore.messageHistory$;
  }

  /**
   * Get message history with optional limit (from in-memory store for performance)
   */
  async getMessageHistory(limit?: number): Promise<DomainMessage[]> {
    await this.ensureInitialized();
    return this.inMemoryStore.getMessageHistory(limit);
  }

  /**
   * Get messages by type (from in-memory store for performance)
   */
  async getMessagesByType(type: DomainMessage['type']): Promise<DomainMessage[]> {
    await this.ensureInitialized();
    return this.inMemoryStore.getMessagesByType(type);
  }

  /**
   * Search messages by regex pattern with optional type filtering (from in-memory store for performance)
   */
  async searchByRegex(pattern: string, limit?: number, type?: DomainMessage['type']): Promise<DomainMessage[]> {
    await this.ensureInitialized();
    return this.inMemoryStore.searchByRegex(pattern, limit, type);
  }

  /**
   * Get message by ID (from in-memory store for performance)
   */
  async getMessageById(messageId: string): Promise<DomainMessage | null> {
    await this.ensureInitialized();
    return this.inMemoryStore.getMessageById(messageId);
  }

  /**
   * Store a single message (to both stores)
   */
  async storeMessage(message: DomainMessage): Promise<void> {
    await this.ensureInitialized();
    
    // Store in both stores concurrently
    await Promise.all([
      this.inMemoryStore.storeMessage(message),
      this.persistentStore.storeMessage(message)
    ]);
  }

  /**
   * Store multiple messages (to both stores)
   */
  async storeMessages(messages: DomainMessage[]): Promise<void> {
    await this.ensureInitialized();
    
    // Store in both stores concurrently
    await Promise.all([
      this.inMemoryStore.storeMessages(messages),
      this.persistentStore.storeMessages(messages)
    ]);
  }

  /**
   * Update existing message by ID (in both stores)
   */
  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {
    await this.ensureInitialized();
    
    // Update in both stores concurrently
    await Promise.all([
      this.inMemoryStore.updateMessage(messageId, updates),
      this.persistentStore.updateMessage(messageId, updates)
    ]);
  }

  /**
   * Clear all message history (from both stores)
   */
  async clearHistory(): Promise<void> {
    await this.ensureInitialized();
    
    // Clear both stores concurrently
    await Promise.all([
      this.inMemoryStore.clearHistory(),
      this.persistentStore.clearHistory()
    ]);
  }

  /**
   * Get all messages (from in-memory store for performance)
   */
  async getAllMessages(): Promise<DomainMessage[]> {
    await this.ensureInitialized();
    return this.inMemoryStore.getAllMessages();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async loadPersistentToMemory(): Promise<void> {
    try {
      const persistentMessages = await this.persistentStore.getAllMessages();
      await this.inMemoryStore.storeMessages(persistentMessages);
    } catch (error) {
      // Log but don't fail - in-memory store can work without persistent data
      console.warn('Failed to load persistent messages to memory:', error);
    }
  }
}