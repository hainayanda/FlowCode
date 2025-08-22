/**
 * Database row type for SQLite message storage and retrieval.
 *
 * Represents the raw data structure returned from SQLite database queries
 * for message records. Used as input for message parsing operations.
 */
export interface MessageRow {
    /** Unique identifier for the message */
    id: string;
    /** The textual content of the message */
    content: string;
    /** Message type as stored in database */
    type: string;
    /** Identifier of who/what sent this message */
    sender: string;
    /** Message timestamp as Unix timestamp (milliseconds) */
    timestamp: number;
    /** Serialized metadata as JSON string, null if no metadata */
    metadata: string | null;
}

/**
 * Database row type for SQLite vector storage.
 *
 * Represents the structure of vector embeddings stored in the database,
 * linking them to their associated messages for semantic search operations.
 */
export interface VectorRow {
    /** Unique identifier for the vector record */
    id: string;
    /** ID of the message this vector represents */
    messageId: string;
    /** The embedding vector as an array of numbers */
    vector: number[];
}

/**
 * Vector search result with similarity scoring.
 *
 * Extends VectorRow to include similarity score for ranking search results
 * based on semantic proximity to the query vector.
 */
export interface VectorSearchResult extends VectorRow {
    /** Similarity score between 0 and 1, where 1 is most similar */
    similarity: number;
}
