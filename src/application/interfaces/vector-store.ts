import { Message } from '../models/messages';
import { VectorSearchResult } from '../models/sqlite-message';
import { MessageReader, MessageWriter } from './message-store';

export interface VectorReader {
    searchSimilar(
        vector: number[],
        limit?: number
    ): Promise<VectorSearchResult[]>;
}

export interface VectorWriter {
    storeVector(vector: number[], messageId: string): Promise<void>;
}

export interface VectorStore extends VectorReader, VectorWriter {}

export interface VectorMessageReader extends MessageReader {
    searchSimilar(
        message: string,
        limit?: number,
        type?: Message['type']
    ): Promise<Message[]>;
}

export interface VectorMessageStore
    extends VectorMessageReader,
        MessageWriter {}
