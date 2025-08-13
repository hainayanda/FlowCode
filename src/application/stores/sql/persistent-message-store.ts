import { MessageReader, MessageWriter, MessageStore } from '../../interfaces/message-store.js';
import { DomainMessage } from '../../../presentation/view-models/console/console-use-case.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * SQLite-based persistent message store implementation
 * Handles session-based storage in ~/.flowcode/session/ directory
 */
export class PersistentMessageStore implements MessageStore {
  private db: any; // Will be initialized with sqlite3 or better-sqlite3
  private initialized = false;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize SQLite database and create tables if needed
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.ensureDatabaseDirectoryExists();
      // Note: This will need sqlite3 or better-sqlite3 dependency
      // For now, using a simple mock implementation
      this.db = await this.createMockDatabase();
      await this.createTables();
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize persistent store: ${error}`);
    }
  }


  /**
   * Get message history with optional limit
   */
  async getMessageHistory(limit?: number): Promise<DomainMessage[]> {
    await this.ensureInitialized();
    
    const query = limit 
      ? `SELECT * FROM messages ORDER BY timestamp ASC LIMIT ${limit}`
      : 'SELECT * FROM messages ORDER BY timestamp ASC';
    
    const rows = await this.executeQuery(query);
    return rows.map(row => this.deserializeMessage(row));
  }

  /**
   * Get messages by type
   */
  async getMessagesByType(type: DomainMessage['type']): Promise<DomainMessage[]> {
    await this.ensureInitialized();
    
    const query = 'SELECT * FROM messages WHERE type = ? ORDER BY timestamp ASC';
    const rows = await this.executeQuery(query, [type]);
    return rows.map(row => this.deserializeMessage(row));
  }

  /**
   * Search messages by regex pattern with optional type filtering
   */
  async searchByRegex(pattern: string, limit?: number, type?: DomainMessage['type']): Promise<DomainMessage[]> {
    await this.ensureInitialized();
    
    // SQLite REGEXP requires extension, using LIKE as fallback
    const likePattern = `%${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}%`;
    
    let query = 'SELECT * FROM messages WHERE content LIKE ?';
    const params: any[] = [likePattern];
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY timestamp ASC';
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    const rows = await this.executeQuery(query, params);
    return rows.map(row => this.deserializeMessage(row));
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: string): Promise<DomainMessage | null> {
    await this.ensureInitialized();
    
    const query = 'SELECT * FROM messages WHERE id = ?';
    const rows = await this.executeQuery(query, [messageId]);
    
    return rows.length > 0 ? this.deserializeMessage(rows[0]) : null;
  }

  /**
   * Store a single message (replace if same ID exists)
   */
  async storeMessage(message: DomainMessage): Promise<void> {
    await this.ensureInitialized();
    
    const serialized = this.serializeMessage(message);
    const query = `
      INSERT OR REPLACE INTO messages (id, type, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    await this.executeQuery(query, [
      serialized.id,
      serialized.type,
      serialized.content,
      serialized.timestamp,
      serialized.metadata
    ]);
  }

  /**
   * Store multiple messages
   */
  async storeMessages(messages: DomainMessage[]): Promise<void> {
    await this.ensureInitialized();
    
    // Use transaction for bulk insert
    await this.executeTransaction(async () => {
      for (const message of messages) {
        await this.storeMessage(message);
      }
    });
  }

  /**
   * Update existing message by ID
   */
  async updateMessage(messageId: string, updates: Partial<DomainMessage>): Promise<void> {
    await this.ensureInitialized();
    
    const existing = await this.getMessageById(messageId);
    if (!existing) return;
    
    const updated = Object.assign({}, existing, updates) as DomainMessage;
    await this.storeMessage(updated);
  }
  
  /**
   * Clear all message history
   */
  async clearHistory(): Promise<void> {
    await this.ensureInitialized();
    
    const query = 'DELETE FROM messages';
    await this.executeQuery(query);
  }

  /**
   * Get all messages
   */
  async getAllMessages(): Promise<DomainMessage[]> {
    await this.ensureInitialized();
    
    const query = 'SELECT * FROM messages ORDER BY timestamp ASC';
    const rows = await this.executeQuery(query);
    return rows.map(row => this.deserializeMessage(row));
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async createTables(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        metadata TEXT
      )
    `;
    
    await this.executeQuery(createTableQuery);
  }

  private serializeMessage(message: DomainMessage): any {
    const hasMetadata = 'metadata' in message && message.metadata !== undefined;
    return {
      id: message.id,
      type: message.type,
      content: message.content,
      timestamp: message.timestamp.toISOString(),
      metadata: hasMetadata ? JSON.stringify(message.metadata) : null
    };
  }

  private deserializeMessage(row: any): DomainMessage {
    const base = {
      id: row.id,
      content: row.content,
      timestamp: new Date(row.timestamp)
    };

    switch (row.type) {
      case 'user-input':
        return {
          ...base,
          type: 'user-input'
        };
        
      case 'system':
        return {
          ...base,
          type: 'system'
        };
        
      case 'ai-response': {
        const metadata = row.metadata ? JSON.parse(row.metadata) : { workerId: 'unknown' };
        return {
          ...base,
          type: 'ai-response',
          metadata
        };
      }
      
      case 'ai-thinking': {
        const metadata = row.metadata ? JSON.parse(row.metadata) : { workerId: 'unknown' };
        return {
          ...base,
          type: 'ai-thinking',
          metadata
        };
      }
      
      case 'error': {
        const metadata = row.metadata ? JSON.parse(row.metadata) : {};
        return {
          ...base,
          type: 'error',
          metadata
        };
      }
      
      case 'file-operation': {
        const metadata = row.metadata ? JSON.parse(row.metadata) : { 
          filePath: '', 
          fileOperation: 'edit' as const 
        };
        return {
          ...base,
          type: 'file-operation',
          metadata
        };
      }
      
      case 'user-choice': {
        const metadata = row.metadata ? JSON.parse(row.metadata) : { 
          choices: [], 
          selectedIndex: -1, 
          prompt: '' 
        };
        return {
          ...base,
          type: 'user-choice',
          metadata
        };
      }
      
      default:
        throw new Error(`Unknown message type: ${row.type}`);
    }
  }

  private async createMockDatabase(): Promise<any> {
    // Mock implementation - in real implementation, this would use sqlite3/better-sqlite3
    return {
      data: new Map<string, any>(),
      transaction: false
    };
  }

  private async executeQuery(query: string, params: any[] = []): Promise<any[]> {
    // Mock implementation - in real implementation, this would execute SQL
    console.log(`Mock SQL: ${query}`, params);
    return [];
  }

  private async executeTransaction(callback: () => Promise<void>): Promise<void> {
    // Mock implementation - in real implementation, this would use DB transactions
    this.db.transaction = true;
    try {
      await callback();
    } finally {
      this.db.transaction = false;
    }
  }


  private async ensureDatabaseDirectoryExists(): Promise<void> {
    const dbDir = this.dbPath.substring(0, this.dbPath.lastIndexOf('/'));
    
    try {
      await fs.mkdir(dbDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create database directory: ${error}`);
    }
  }

}