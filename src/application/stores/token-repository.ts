import { TokenStore } from '../interfaces/token-store';

/**
 * In-memory token usage repository.
 *
 * Provides a simple in-memory storage for tracking token usage across different agents.
 * Data is maintained only for the duration of the application lifecycle and is not
 * persisted to disk.
 */
export class TokenRepository implements TokenStore {
    private _tokenUsages: Record<string, number> = {};

    /**
     * Gets the current token usage record for all agents.
     *
     * @returns Record mapping agent names to their token usage counts
     */
    get tokenUsages(): Record<string, number> {
        return { ...this._tokenUsages };
    }

    /**
     * Gets the token usage for a specific agent.
     *
     * @param agentName - Name of the agent to get usage for
     * @returns Number of tokens used by the agent, or 0 if not found
     */
    getTokenUsage(agentName: string): number {
        return this._tokenUsages[agentName] ?? 0;
    }

    /**
     * Gets the total token usage across all agents.
     *
     * @returns Sum of all token usage across all agents
     */
    getTotalTokenUsage(): number {
        return Object.values(this._tokenUsages).reduce(
            (total, usage) => total + usage,
            0
        );
    }

    /**
     * Increments the token usage for a specific agent.
     *
     * @param agentName - Name of the agent to increment usage for
     * @param amount - Number of tokens to add to the agent's usage count
     */
    incrementTokenUsage(agentName: string, amount: number): void {
        if (amount < 0) {
            throw new Error(
                'Token usage increment amount must be non-negative'
            );
        }

        this._tokenUsages[agentName] =
            (this._tokenUsages[agentName] ?? 0) + amount;
    }
}
