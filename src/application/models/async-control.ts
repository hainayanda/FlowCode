import { Message } from './messages';

/**
 * Control signal used to manage async generator execution flow.
 * Allows callers to continue, abort, or provide additional context for iterations.
 */
export interface AsyncControl {
    /** The type of control action to take */
    type: `continue` | `abort`;
    /** Message to send in response to the choice or prompt */
    responseMessage?: Message;
    /** Additional messages to append to the conversation history for the next iteration */
    queuedMessages?: Message[];
    /** Summarized messages that replace the entire conversation history for cost efficiency */
    summarizedMessages?: Message[];
}

/**
 * Response returned when an async generator completes an iteration.
 * Contains the generated messages, completion status, and resource usage metrics.
 */
export interface AsyncControlResponse {
    /** Messages generated during this iteration */
    messages: Message[];
    /** How the iteration completed - either naturally finished or was aborted */
    completedReason: `completed` | `aborted`;
    /** Resource usage metrics for this iteration */
    usage: {
        /** Number of input tokens consumed */
        inputTokens: number;
        /** Number of output tokens generated */
        outputTokens: number;
        /** Number of tools that were used */
        toolsUsed: number;
    };
}
