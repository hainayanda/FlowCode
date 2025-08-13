import { BehaviorSubject } from 'rxjs';
import { MessageStorePublisher, MessageStore } from '../../../src/application/interfaces/message-store.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

/**
 * Mock MessageStorePublisher for testing
 */
export class MockMessageStorePublisher implements MessageStorePublisher {
  private readonly messageHistorySubject = new BehaviorSubject<DomainMessage[]>([]);
  private messages: DomainMessage[] = [];
  
  public initializeCalled = false;
  public storeMessageCalled = false;
  public storeMessagesCalled = false;
  public updateMessageCalled = false;
  public clearHistoryCalled = false;
  
  public lastStoredMessage: DomainMessage | null = null;
  public lastStoredMessages: DomainMessage[] = [];
  public lastUpdateId = '';
  public lastUpdateData: Partial<DomainMessage> = {};

  get messageHistory$() {
    return this.messageHistorySubject.asObservable();
  }

  async initialize(): Promise<void> {
    this.initializeCalled = true;
  }

  async getMessageHistory(limit?: number): Promise<DomainMessage[]> {
    const sorted = [...this.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return limit ? sorted.slice(-limit) : sorted;
  }

  async getMessagesByType(type: DomainMessage['type']): Promise<DomainMessage[]> {
    return this.messages.filter(msg => msg.type === type);
  }

  async searchByRegex(pattern: string, limit?: number, type?: DomainMessage['type']): Promise<DomainMessage[]> {
    const regex = new RegExp(pattern, 'i');
    let matches = this.messages.filter(msg => regex.test(msg.content));
    if (type) {
      matches = matches.filter(msg => msg.type === type);
    }
    return limit ? matches.slice(-limit) : matches;
  }

  async getMessageById(messageId: string): Promise<DomainMessage | null> {
    return this.messages.find(msg => msg.id === messageId) || null;
  }

  async storeMessage(message: DomainMessage): Promise<void> {
    this.storeMessageCalled = true;
    this.lastStoredMessage = message;
    
    const existingIndex = this.messages.findIndex(msg => msg.id === message.id);
    if (existingIndex >= 0) {
      this.messages[existingIndex] = message;
    } else {
      this.messages.push(message);
    }
    this.emitUpdatedHistory();
  }

  async storeMessages(messages: DomainMessage[]): Promise<void> {
    this.storeMessagesCalled = true;
    this.lastStoredMessages = messages;
    
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

  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {
    this.updateMessageCalled = true;
    this.lastUpdateId = messageId;
    this.lastUpdateData = updates;
    
    const existingIndex = this.messages.findIndex(msg => msg.id === messageId);
    if (existingIndex >= 0) {
      this.messages[existingIndex] = Object.assign({}, this.messages[existingIndex], updates) as DomainMessage;
      this.emitUpdatedHistory();
    }
  }

  async clearHistory(): Promise<void> {
    this.clearHistoryCalled = true;
    this.messages = [];
    this.emitUpdatedHistory();
  }

  async getAllMessages(): Promise<DomainMessage[]> {
    return [...this.messages];
  }

  // Test helper methods
  reset(): void {
    this.initializeCalled = false;
    this.storeMessageCalled = false;
    this.storeMessagesCalled = false;
    this.updateMessageCalled = false;
    this.clearHistoryCalled = false;
    this.lastStoredMessage = null;
    this.lastStoredMessages = [];
    this.lastUpdateId = '';
    this.lastUpdateData = {};
    this.messages = [];
    this.emitUpdatedHistory();
  }

  setMessages(messages: DomainMessage[]): void {
    this.messages = [...messages];
    this.emitUpdatedHistory();
  }

  private emitUpdatedHistory(): void {
    const sorted = [...this.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.messageHistorySubject.next(sorted);
  }
}

/**
 * Mock MessageStore for testing
 */
export class MockMessageStore implements MessageStore {
  private messages: DomainMessage[] = [];
  
  public initializeCalled = false;
  public storeMessageCalled = false;
  public storeMessagesCalled = false;
  public updateMessageCalled = false;
  public clearHistoryCalled = false;
  public getAllMessagesCalled = false;
  
  public lastStoredMessage: DomainMessage | null = null;
  public lastStoredMessages: DomainMessage[] = [];
  public lastUpdateId = '';
  public lastUpdateData: Partial<DomainMessage> = {};

  async initialize(): Promise<void> {
    this.initializeCalled = true;
  }

  async getMessageHistory(limit?: number): Promise<DomainMessage[]> {
    const sorted = [...this.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return limit ? sorted.slice(-limit) : sorted;
  }

  async getMessagesByType(type: DomainMessage['type']): Promise<DomainMessage[]> {
    return this.messages.filter(msg => msg.type === type);
  }

  async searchByRegex(pattern: string, limit?: number, type?: DomainMessage['type']): Promise<DomainMessage[]> {
    const regex = new RegExp(pattern, 'i');
    let matches = this.messages.filter(msg => regex.test(msg.content));
    if (type) {
      matches = matches.filter(msg => msg.type === type);
    }
    return limit ? matches.slice(-limit) : matches;
  }

  async getMessageById(messageId: string): Promise<DomainMessage | null> {
    return this.messages.find(msg => msg.id === messageId) || null;
  }

  async storeMessage(message: DomainMessage): Promise<void> {
    this.storeMessageCalled = true;
    this.lastStoredMessage = message;
    
    const existingIndex = this.messages.findIndex(msg => msg.id === message.id);
    if (existingIndex >= 0) {
      this.messages[existingIndex] = message;
    } else {
      this.messages.push(message);
    }
  }

  async storeMessages(messages: DomainMessage[]): Promise<void> {
    this.storeMessagesCalled = true;
    this.lastStoredMessages = messages;
    
    for (const message of messages) {
      const existingIndex = this.messages.findIndex(msg => msg.id === message.id);
      if (existingIndex >= 0) {
        this.messages[existingIndex] = message;
      } else {
        this.messages.push(message);
      }
    }
  }

  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {
    this.updateMessageCalled = true;
    this.lastUpdateId = messageId;
    this.lastUpdateData = updates;
    
    const existingIndex = this.messages.findIndex(msg => msg.id === messageId);
    if (existingIndex >= 0) {
      this.messages[existingIndex] = Object.assign({}, this.messages[existingIndex], updates) as DomainMessage;
    }
  }

  async clearHistory(): Promise<void> {
    this.clearHistoryCalled = true;
    this.messages = [];
  }

  async getAllMessages(): Promise<DomainMessage[]> {
    this.getAllMessagesCalled = true;
    return [...this.messages];
  }

  // Test helper methods
  reset(): void {
    this.initializeCalled = false;
    this.storeMessageCalled = false;
    this.storeMessagesCalled = false;
    this.updateMessageCalled = false;
    this.clearHistoryCalled = false;
    this.getAllMessagesCalled = false;
    this.lastStoredMessage = null;
    this.lastStoredMessages = [];
    this.lastUpdateId = '';
    this.lastUpdateData = {};
    this.messages = [];
  }

  setMessages(messages: DomainMessage[]): void {
    this.messages = [...messages];
  }
}

/**
 * Helper function to create test domain messages
 */
export function createTestMessage(
  id: string, 
  type: DomainMessage['type'] = 'user-input', 
  content = 'test content'
): DomainMessage {
  const base = {
    id,
    content,
    timestamp: new Date()
  };

  switch (type) {
    case 'user-input':
    case 'system':
      return { ...base, type };
    case 'ai-response':
    case 'ai-thinking':
      return { ...base, type, metadata: { workerId: 'test-worker' } };
    case 'error':
      return { ...base, type, metadata: {} };
    case 'file-operation':
      return { ...base, type, metadata: { filePath: '/test/file.ts', fileOperation: 'edit' } };
    case 'user-choice':
      return { ...base, type, metadata: { choices: ['yes', 'no'], selectedIndex: -1, prompt: 'test?' } };
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}