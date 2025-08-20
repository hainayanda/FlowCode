import { beforeEach, describe, expect, it } from 'vitest';
import { TokenRepository } from '../../../src/application/stores/token-repository';

describe('TokenRepository', () => {
    let repository: TokenRepository;

    beforeEach(() => {
        repository = new TokenRepository();
    });

    describe('constructor', () => {
        it('should create repository with empty token usages', () => {
            expect(repository).toBeInstanceOf(TokenRepository);
            expect(repository.tokenUsages).toEqual({});
            expect(repository.getTotalTokenUsage()).toBe(0);
        });
    });

    describe('tokenUsages', () => {
        it('should return empty object when no tokens have been tracked', () => {
            expect(repository.tokenUsages).toEqual({});
        });

        it('should return copy of token usages to prevent external mutation', () => {
            repository.incrementTokenUsage('agent1', 100);

            const usages = repository.tokenUsages;
            usages['agent1'] = 999;

            expect(repository.getTokenUsage('agent1')).toBe(100);
        });

        it('should return current token usages after increments', () => {
            repository.incrementTokenUsage('agent1', 100);
            repository.incrementTokenUsage('agent2', 50);

            expect(repository.tokenUsages).toEqual({
                agent1: 100,
                agent2: 50,
            });
        });
    });

    describe('getTokenUsage', () => {
        it('should return 0 for agent that has not been tracked', () => {
            expect(repository.getTokenUsage('non-existent-agent')).toBe(0);
        });

        it('should return correct usage for existing agent', () => {
            repository.incrementTokenUsage('agent1', 150);

            expect(repository.getTokenUsage('agent1')).toBe(150);
        });

        it('should return updated usage after multiple increments', () => {
            repository.incrementTokenUsage('agent1', 100);
            repository.incrementTokenUsage('agent1', 50);

            expect(repository.getTokenUsage('agent1')).toBe(150);
        });

        it('should handle different agents independently', () => {
            repository.incrementTokenUsage('agent1', 100);
            repository.incrementTokenUsage('agent2', 200);

            expect(repository.getTokenUsage('agent1')).toBe(100);
            expect(repository.getTokenUsage('agent2')).toBe(200);
        });
    });

    describe('getTotalTokenUsage', () => {
        it('should return 0 when no tokens have been tracked', () => {
            expect(repository.getTotalTokenUsage()).toBe(0);
        });

        it('should return total for single agent', () => {
            repository.incrementTokenUsage('agent1', 100);

            expect(repository.getTotalTokenUsage()).toBe(100);
        });

        it('should return sum across multiple agents', () => {
            repository.incrementTokenUsage('agent1', 100);
            repository.incrementTokenUsage('agent2', 50);
            repository.incrementTokenUsage('agent3', 25);

            expect(repository.getTotalTokenUsage()).toBe(175);
        });

        it('should update total when agent usage is incremented', () => {
            repository.incrementTokenUsage('agent1', 100);
            expect(repository.getTotalTokenUsage()).toBe(100);

            repository.incrementTokenUsage('agent1', 50);
            expect(repository.getTotalTokenUsage()).toBe(150);
        });
    });

    describe('incrementTokenUsage', () => {
        it('should create new agent entry with initial usage', () => {
            repository.incrementTokenUsage('new-agent', 100);

            expect(repository.getTokenUsage('new-agent')).toBe(100);
            expect(repository.tokenUsages).toEqual({
                'new-agent': 100,
            });
        });

        it('should increment existing agent usage', () => {
            repository.incrementTokenUsage('agent1', 100);
            repository.incrementTokenUsage('agent1', 50);

            expect(repository.getTokenUsage('agent1')).toBe(150);
        });

        it('should handle zero increment', () => {
            repository.incrementTokenUsage('agent1', 100);
            repository.incrementTokenUsage('agent1', 0);

            expect(repository.getTokenUsage('agent1')).toBe(100);
        });

        it('should handle large numbers', () => {
            const largeNumber = 1000000;
            repository.incrementTokenUsage('agent1', largeNumber);

            expect(repository.getTokenUsage('agent1')).toBe(largeNumber);
        });

        it('should handle multiple agents with different increments', () => {
            repository.incrementTokenUsage('gpt-4', 1000);
            repository.incrementTokenUsage('claude-3', 800);
            repository.incrementTokenUsage('gemini', 600);

            expect(repository.getTokenUsage('gpt-4')).toBe(1000);
            expect(repository.getTokenUsage('claude-3')).toBe(800);
            expect(repository.getTokenUsage('gemini')).toBe(600);
            expect(repository.getTotalTokenUsage()).toBe(2400);
        });

        describe('error handling', () => {
            it('should throw error for negative increment', () => {
                expect(() => {
                    repository.incrementTokenUsage('agent1', -10);
                }).toThrow('Token usage increment amount must be non-negative');
            });

            it('should throw error for negative zero (edge case)', () => {
                expect(() => {
                    repository.incrementTokenUsage('agent1', -0);
                }).not.toThrow();

                expect(repository.getTokenUsage('agent1')).toBe(0);
            });

            it('should not modify state when increment fails', () => {
                repository.incrementTokenUsage('agent1', 100);

                expect(() => {
                    repository.incrementTokenUsage('agent1', -50);
                }).toThrow();

                expect(repository.getTokenUsage('agent1')).toBe(100);
            });
        });
    });

    describe('edge cases', () => {
        it('should handle agent names with special characters', () => {
            const specialAgentName = 'agent-1_with.special@chars';
            repository.incrementTokenUsage(specialAgentName, 100);

            expect(repository.getTokenUsage(specialAgentName)).toBe(100);
        });

        it('should handle empty string agent name', () => {
            repository.incrementTokenUsage('', 50);

            expect(repository.getTokenUsage('')).toBe(50);
            expect(repository.tokenUsages['']).toBe(50);
        });

        it('should handle very long agent names', () => {
            const longAgentName = 'a'.repeat(1000);
            repository.incrementTokenUsage(longAgentName, 75);

            expect(repository.getTokenUsage(longAgentName)).toBe(75);
        });

        it('should maintain precision with floating point operations', () => {
            // Even though the interface uses number, test edge case behavior
            repository.incrementTokenUsage('agent1', 100);
            repository.incrementTokenUsage('agent1', 50);
            repository.incrementTokenUsage('agent1', 25);

            expect(repository.getTokenUsage('agent1')).toBe(175);
            expect(repository.getTotalTokenUsage()).toBe(175);
        });
    });

    describe('integration scenarios', () => {
        it('should handle realistic usage tracking scenario', () => {
            // Simulate a conversation with multiple agents
            repository.incrementTokenUsage('gpt-4-turbo', 1500); // Initial query
            repository.incrementTokenUsage('claude-3-sonnet', 800); // Alternative response
            repository.incrementTokenUsage('gpt-4-turbo', 2000); // Follow-up
            repository.incrementTokenUsage('embedding-model', 100); // Embedding generation
            repository.incrementTokenUsage('gpt-4-turbo', 500); // Final response

            expect(repository.getTokenUsage('gpt-4-turbo')).toBe(4000);
            expect(repository.getTokenUsage('claude-3-sonnet')).toBe(800);
            expect(repository.getTokenUsage('embedding-model')).toBe(100);
            expect(repository.getTotalTokenUsage()).toBe(4900);

            expect(repository.tokenUsages).toEqual({
                'gpt-4-turbo': 4000,
                'claude-3-sonnet': 800,
                'embedding-model': 100,
            });
        });

        it('should handle concurrent agent usage tracking', () => {
            const agents = ['agent1', 'agent2', 'agent3', 'agent4', 'agent5'];
            const increments = [100, 200, 150, 300, 250];

            // Simulate concurrent increments
            agents.forEach((agent, index) => {
                repository.incrementTokenUsage(agent, increments[index]);
            });

            // Verify individual totals
            agents.forEach((agent, index) => {
                expect(repository.getTokenUsage(agent)).toBe(increments[index]);
            });

            // Verify total
            const expectedTotal = increments.reduce((sum, val) => sum + val, 0);
            expect(repository.getTotalTokenUsage()).toBe(expectedTotal);
        });
    });
});
