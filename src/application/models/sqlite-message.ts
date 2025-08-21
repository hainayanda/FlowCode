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

export interface VectorRow {
    id: string;
    messageId: string;
    vector: number[];
}

export interface VectorSearchResult extends VectorRow {
    similarity: number;
}
