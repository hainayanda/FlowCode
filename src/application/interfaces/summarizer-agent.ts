import { AgentMessage } from './agent.js';

/**
 * Summary result containing the generated summary and metadata
 */
export interface SummaryResult {
  /**
   * The generated summary text
   */
  summary: string;
  
  /**
   * Number of messages that were summarized
   */
  messageCount: number;
  
  /**
   * Time period covered by the messages
   */
  timeSpan?: {
    start: Date;
    end: Date;
  };
  
  /**
   * Token usage for the summarization request
   */
  tokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Interface for agents that can summarize message conversations
 */
export interface SummarizerAgent {
  /**
   * Generate a detailed summary of the provided messages
   * 
   * @param messages Array of messages to summarize
   * @returns Promise resolving to the summary result
   */
  summarizeMessages(messages: AgentMessage[]): Promise<SummaryResult>;
}