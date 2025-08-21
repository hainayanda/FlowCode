import { Message } from '../models/messages';

/**
 * Interface for text summarization services.
 * Provides functionality to condense collections of messages into concise summaries.
 */
export interface Summarizer {
    /**
     * Summarizes a collection of messages into a concise text summary.
     *
     * @param text - Array of messages to be summarized
     * @returns Promise resolving to a string containing the summarized content
     */
    summarize(text: Message[]): Promise<string>;
}
