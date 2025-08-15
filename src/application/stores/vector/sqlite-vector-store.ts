import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { VectorStore, VectorResult } from '../../interfaces/vector-store.js';

/**
 * SQLite-based persistent vector store using sqlite-vss for similarity search
 * Stores vectors in .flowcode/vectors.db
 */
export class SQLiteVectorStore implements VectorStore {
  private db: Database.Database | null = null;
  private dbPath: string;
  private initialized = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize the vector store (create tables, indices, etc.)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure .flowcode directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize SQLite database
      this.db = new Database(this.dbPath);
      
      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      
      // Load sqlite-vss extension
      try {
        this.db.loadExtension('sqlite-vss');
      } catch (error) {
        console.warn('sqlite-vss extension not available, falling back to basic storage:', error);
      }

      // Create vectors table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS vectors (
          id TEXT PRIMARY KEY,
          vector BLOB NOT NULL,
          metadata TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create virtual table for vector similarity search (if vss is available)
      try {
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vector_index USING vss0(
            vector(384)  -- Default dimension, can be adjusted based on embedding service
          )
        `);
      } catch (error) {
        console.warn('Vector similarity search not available, using basic storage only:', error);
      }

      // Create index on metadata for faster filtering
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_vectors_metadata ON vectors(json_extract(metadata, '$.type'));
        CREATE INDEX IF NOT EXISTS idx_vectors_created_at ON vectors(created_at);
      `);

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize SQLite vector store: ${error}`);
    }
  }

  /**
   * Store a vector with associated metadata
   */
  async storeVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    await this.ensureInitialized();
    
    const stmt = this.db!.prepare(`
      INSERT OR REPLACE INTO vectors (id, vector, metadata, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    const vectorBuffer = Buffer.from(new Float32Array(vector).buffer);
    const metadataJson = JSON.stringify(metadata);
    
    stmt.run(id, vectorBuffer, metadataJson);

    // Also store in vector index for similarity search (if available)
    try {
      const indexStmt = this.db!.prepare(`
        INSERT OR REPLACE INTO vector_index (rowid, vector)
        VALUES ((SELECT rowid FROM vectors WHERE id = ?), ?)
      `);
      indexStmt.run(id, vectorBuffer);
    } catch {
      // Vector index not available, continue with basic storage
    }
  }

  /**
   * Update existing vector and metadata
   */
  async updateVector(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
    await this.ensureInitialized();
    
    const exists = await this.hasVector(id);
    if (!exists) {
      throw new Error(`Vector with id ${id} does not exist`);
    }
    
    // Use same logic as storeVector for updates
    await this.storeVector(id, vector, metadata);
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async searchSimilar(queryVector: number[], limit = 10): Promise<VectorResult[]> {
    await this.ensureInitialized();
    
    const queryBuffer = Buffer.from(new Float32Array(queryVector).buffer);
    
    try {
      // Try vector similarity search first (if vss is available)
      const stmt = this.db!.prepare(`
        SELECT 
          v.id,
          v.vector,
          v.metadata,
          vss.distance
        FROM vector_index vss
        JOIN vectors v ON v.rowid = vss.rowid
        WHERE vss_search(vector, ?)
        ORDER BY vss.distance ASC
        LIMIT ?
      `);
      
      const rows = stmt.all(queryBuffer, limit);
      return this.mapRowsToVectorResults(rows);
      
    } catch (error) {
      // Fallback to basic retrieval without similarity scoring
      console.warn('Vector similarity search not available, returning recent vectors:', error);
      
      const stmt = this.db!.prepare(`
        SELECT id, vector, metadata, 0 as distance
        FROM vectors
        ORDER BY created_at DESC
        LIMIT ?
      `);
      
      const rows = stmt.all(limit);
      return this.mapRowsToVectorResults(rows);
    }
  }

  /**
   * Remove vector by ID
   */
  async removeVector(id: string): Promise<void> {
    await this.ensureInitialized();
    
    // Get rowid before deletion for vector index cleanup
    const rowidStmt = this.db!.prepare('SELECT rowid FROM vectors WHERE id = ?');
    const row = rowidStmt.get(id) as { rowid: number } | undefined;
    
    // Remove from main table
    const stmt = this.db!.prepare('DELETE FROM vectors WHERE id = ?');
    stmt.run(id);
    
    // Remove from vector index (if available and exists)
    if (row) {
      try {
        const indexStmt = this.db!.prepare('DELETE FROM vector_index WHERE rowid = ?');
        indexStmt.run(row.rowid);
      } catch {
        // Vector index not available, ignore
      }
    }
  }

  /**
   * Clear all vectors
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    
    this.db!.exec('DELETE FROM vectors');
    
    try {
      this.db!.exec('DELETE FROM vector_index');
    } catch {
      // Vector index not available, ignore
    }
  }

  /**
   * Check if vector exists by ID
   */
  async hasVector(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const stmt = this.db!.prepare('SELECT 1 FROM vectors WHERE id = ? LIMIT 1');
    const result = stmt.get(id);
    return result !== undefined;
  }

  /**
   * Get total number of stored vectors
   */
  async getVectorCount(): Promise<number> {
    await this.ensureInitialized();
    
    const stmt = this.db!.prepare('SELECT COUNT(*) as count FROM vectors');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private mapRowsToVectorResults(rows: any[]): VectorResult[] {
    return rows.map(row => ({
      id: row.id,
      vector: this.bufferToVector(row.vector),
      metadata: JSON.parse(row.metadata),
      distance: row.distance || 0
    }));
  }

  private bufferToVector(buffer: Buffer): number[] {
    const float32Array = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    return Array.from(float32Array);
  }
}