/**
 * Information about a FlowCode session
 *
 * Contains all metadata and file paths associated with a user session.
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
     * Absolute path to the message database file
     *
     * Points to the SQLite database file containing the conversation history
     * for this session. The file is created automatically when the session
     * is initialized.
     */
    messageDbPath: string;

    /**
     * Absolute path to the vector database file
     *
     * Points to the vector database file used for semantic search and
     * context retrieval within this session. The file is created automatically
     * when the session is initialized.
     */
    vectorDbPath: string;
}
