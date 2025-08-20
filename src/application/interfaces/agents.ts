import type {
    AsyncControl,
    AsyncControlResponse,
} from '../models/async-control';
import type { Message } from '../models/messages';
import { SummaryResult } from '../models/summary';

/**
 * Parameters required to execute an agent process.
 * Contains the user prompt and conversation history.
 */
export interface AgentExecutionParameters {
    /** The user's prompt or instruction */
    prompt: string;
    /** Conversation history messages */
    messages: Message[];
}

/**
 * Core interface for agent workers that can process user requests.
 * Supports both single iteration and multi-iteration processing with async generators.
 */
export interface AgentWorker {
    /**
     * Processes a single iteration of the agent workflow.
     * @param parameters - The execution parameters containing prompt and message history
     * @returns AsyncGenerator that yields intermediate messages and returns final response
     */
    singleProcess(
        parameters: AgentExecutionParameters
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;

    /**
     * Processes multiple iterations of the agent workflow until completion or max iterations.
     * @param parameters - The execution parameters containing prompt and message history
     * @param maxIterations - Maximum number of iterations to run (defaults to 25)
     * @returns AsyncGenerator that yields intermediate messages and returns final response
     */
    process(
        parameters: AgentExecutionParameters,
        maxIterations?: number
    ): AsyncGenerator<Message, AsyncControlResponse, AsyncControl>;
}

/**
 * Interface for agents that can summarize conversation history.
 * Used to reduce token costs by condensing long conversations.
 */
export interface AgentSummarizer {
    /**
     * Summarizes the conversation history to reduce token usage.
     * @param parameters - The execution parameters containing the conversation to summarize
     * @returns Promise resolving to summary result
     */
    summarize(parameters: AgentExecutionParameters): Promise<SummaryResult>;
}

/**
 * Interface for agents that can generate embeddings from text.
 * Used for semantic search and similarity operations.
 */
export interface AgentEmbedder {
    /** Whether the embedder is available for use */
    isAvailable: boolean;

    /**
     * Generates an embedding vector from the input text.
     * @param text - The text to embed
     * @returns Promise resolving to the embedding vector
     */
    embed(text: string): Promise<number[]>;
}
