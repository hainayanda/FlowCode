import Database from 'better-sqlite3';

/**
 * Information about a FlowCode session
 *
 * Contains all metadata and database instance associated with a user session.
 * Each session maintains its own isolated message history and vector database.
 */
export interface SessionInfo {
    /**
     * The unique identifier for the session
     *
     * A hex-encoded timestamp representing when the session was created.
     * This serves as both the session ID and the directory name.
     */
    name: string;

    /**
     * The last time this session was actively used
     *
     * Updated whenever the session is accessed or modified.
     * Used for sorting sessions by recency in session history.
     */
    lastActiveDate: Date;

    /**
     * SQLite database instance for this session
     *
     * Contains both the conversation history and vector embeddings.
     * The database instance is managed by the session and shared
     * between message and vector stores.
     */
    database: Database.Database;
}
