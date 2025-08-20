/**
 * Interface for reading token usage data.
 *
 * Provides methods to access token consumption metrics across different agents
 * and retrieve aggregated usage statistics.
 */
export interface TokenReader {
    /**
     * Record of token usage by agent name.
     *
     * @returns Record mapping agent names to their total token consumption
     */
    tokenUsages: Record<string, number>;

    /**
     * Gets the token usage for a specific agent.
     *
     * @param agentName - Name of the agent to get usage for
     * @returns Number of tokens consumed by the agent, or 0 if agent not found
     */
    getTokenUsage(agentName: string): number;

    /**
     * Gets the total token usage across all agents.
     *
     * @returns Sum of token consumption across all tracked agents
     */
    getTotalTokenUsage(): number;
}

/**
 * Interface for writing/updating token usage data.
 *
 * Provides methods to record and increment token consumption for agents.
 */
export interface TokenWriter {
    /**
     * Increments the token usage for a specific agent.
     *
     * @param agentName - Name of the agent to increment usage for
     * @param amount - Number of tokens to add (must be non-negative)
     * @throws Error if amount is negative
     */
    incrementTokenUsage(agentName: string, amount: number): void;
}

/**
 * Combined interface for token storage operations.
 *
 * Provides both read and write access to token usage data, enabling
 * comprehensive token tracking and reporting capabilities.
 */
export interface TokenStore extends TokenReader, TokenWriter {}
