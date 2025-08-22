/**
 * Result of a conversation summarization operation.
 *
 * Contains the generated summary along with metadata about the summarization
 * process, including message counts, time spans, and token usage statistics.
 */
export interface SummaryResult {
    /** The generated summary text */
    summary: string;

    /** Number of messages that were summarized */
    messageCount: number;

    /** Optional time span of the summarized conversation */
    timeSpan?: {
        /** Start time of the conversation period */
        start: Date;

        /** End time of the conversation period */
        end: Date;
    };

    /** Token and tool usage statistics for the summarization */
    usage: {
        /** Number of input tokens consumed */
        inputTokens: number;

        /** Number of output tokens generated */
        outputTokens: number;

        /** Number of tools used during summarization */
        toolsUsed: number;
    };
}
