import { beforeEach, describe, expect, it } from 'vitest';
import { SummarizerWorker } from '../../../src/application/agents/summarizer-worker';
import { AgentExecutionParameters } from '../../../src/application/agents/interfaces/agent';
import {
    TestWorker,
    createMockConfig,
    createMockMessage,
} from './test-worker.mocks';

describe('SummarizerWorker', () => {
    let summarizer: SummarizerWorker;
    let mockWorker: TestWorker;

    beforeEach(() => {
        const mockConfig = createMockConfig();
        mockWorker = new TestWorker('test-summarizer', mockConfig);
        summarizer = new SummarizerWorker(mockWorker);
    });

    describe('constructor', () => {
        it('should initialize with provided worker', () => {
            expect(summarizer).toBeDefined();
            expect(summarizer['worker']).toBe(mockWorker);
        });
    });

    describe('summarize', () => {
        it('should append summarizer instructions to prompt', async () => {
            const mockMessage = createMockMessage({
                content: 'Summary content',
            });
            mockWorker.setMockMessages([mockMessage]);
            mockWorker.setMockUsage(100, 200, 0);

            const parameters: AgentExecutionParameters = {
                prompt: 'Original prompt',
                messages: [],
            };

            await summarizer.summarize(parameters);

            const processedPrompts = mockWorker.getProcessedPrompts();
            expect(processedPrompts).toHaveLength(1);
            expect(processedPrompts[0]).toContain('Original prompt');
            expect(processedPrompts[0]).toContain(
                '## Summarizer Mode Instructions'
            );
            expect(processedPrompts[0]).toContain('You are a summarizer');
            expect(processedPrompts[0]).toContain(
                'condense the information provided'
            );
        });

        it('should return summary result with single message', async () => {
            const mockMessage = createMockMessage({
                content: 'Test summary content',
            });
            mockWorker.setMockMessages([mockMessage]);
            mockWorker.setMockUsage(150, 75, 0);

            const parameters: AgentExecutionParameters = {
                prompt: 'Summarize this content',
                messages: [],
            };

            const result = await summarizer.summarize(parameters);

            expect(result.summary).toBe('Test summary content');
            expect(result.messageCount).toBe(1);
            expect(result.usage.inputTokens).toBe(150);
            expect(result.usage.outputTokens).toBe(75);
            expect(result.usage.toolsUsed).toBe(0);
        });

        it('should return summary result with multiple messages', async () => {
            const message1 = createMockMessage({
                content: 'First summary line',
            });
            const message2 = createMockMessage({
                content: 'Second summary line',
            });
            const message3 = createMockMessage({
                content: 'Third summary line',
            });

            mockWorker.setMockMessages([message1, message2, message3]);
            mockWorker.setMockUsage(200, 100, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Summarize this content',
                messages: [],
            };

            const result = await summarizer.summarize(parameters);

            expect(result.summary).toBe(
                'First summary line\nSecond summary line\nThird summary line'
            );
            expect(result.messageCount).toBe(3);
            expect(result.usage.inputTokens).toBe(200);
            expect(result.usage.outputTokens).toBe(100);
            expect(result.usage.toolsUsed).toBe(1);
        });

        it('should handle empty messages', async () => {
            mockWorker.setMockMessages([]);
            mockWorker.setMockUsage(50, 0, 0);

            const parameters: AgentExecutionParameters = {
                prompt: 'Summarize this content',
                messages: [],
            };

            const result = await summarizer.summarize(parameters);

            expect(result.summary).toBe('');
            expect(result.messageCount).toBe(0);
            expect(result.usage.inputTokens).toBe(50);
            expect(result.usage.outputTokens).toBe(0);
            expect(result.usage.toolsUsed).toBe(0);
        });

        it('should handle messages with empty content', async () => {
            const emptyMessage1 = createMockMessage({ content: '' });
            const emptyMessage2 = createMockMessage({ content: '' });

            mockWorker.setMockMessages([emptyMessage1, emptyMessage2]);
            mockWorker.setMockUsage(75, 25, 0);

            const parameters: AgentExecutionParameters = {
                prompt: 'Summarize this content',
                messages: [],
            };

            const result = await summarizer.summarize(parameters);

            expect(result.summary).toBe('\n'); // Two empty strings joined by newline
            expect(result.messageCount).toBe(2);
            expect(result.usage.inputTokens).toBe(75);
            expect(result.usage.outputTokens).toBe(25);
            expect(result.usage.toolsUsed).toBe(0);
        });

        it('should process yielded messages from worker correctly', async () => {
            const yieldedMessage = createMockMessage({
                content: 'Yielded message',
            });
            const finalMessage = createMockMessage({
                content: 'Final summary',
            });

            // Set up worker to yield a message before completing
            mockWorker.setShouldYieldMessages([yieldedMessage]);
            mockWorker.setMockMessages([finalMessage]);
            mockWorker.setMockUsage(120, 80, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Summarize this content',
                messages: [],
            };

            const result = await summarizer.summarize(parameters);

            // Should only include the final messages in the summary, not yielded ones
            expect(result.summary).toBe('Final summary');
            expect(result.messageCount).toBe(1);
            expect(result.usage.inputTokens).toBe(120);
            expect(result.usage.outputTokens).toBe(80);
            expect(result.usage.toolsUsed).toBe(1);
        });

        it('should preserve original prompt content while adding instructions', async () => {
            const mockMessage = createMockMessage({
                content: 'Summary result',
            });
            mockWorker.setMockMessages([mockMessage]);
            mockWorker.setMockUsage(100, 50, 0);

            const parameters: AgentExecutionParameters = {
                prompt: 'Please summarize the following complex technical document with specific requirements',
                messages: [],
            };

            await summarizer.summarize(parameters);

            const processedPrompts = mockWorker.getProcessedPrompts();
            expect(processedPrompts[0]).toContain(
                'Please summarize the following complex technical document with specific requirements'
            );
            expect(processedPrompts[0]).toContain(
                '## Summarizer Mode Instructions'
            );
        });

        it('should handle worker that processes with usage statistics', async () => {
            const message1 = createMockMessage({ content: 'Key point 1' });
            const message2 = createMockMessage({ content: 'Key point 2' });

            mockWorker.setMockMessages([message1, message2]);
            mockWorker.setMockUsage(300, 150, 2);

            const parameters: AgentExecutionParameters = {
                prompt: 'Summarize key points',
                messages: [],
            };

            const result = await summarizer.summarize(parameters);

            expect(result.summary).toBe('Key point 1\nKey point 2');
            expect(result.messageCount).toBe(2);
            expect(result.usage.inputTokens).toBe(300);
            expect(result.usage.outputTokens).toBe(150);
            expect(result.usage.toolsUsed).toBe(2);
        });
    });

    describe('summarizeInstructions (private method behavior)', () => {
        it('should include summarizer instructions in processed prompt', async () => {
            const mockMessage = createMockMessage({ content: 'Test' });
            mockWorker.setMockMessages([mockMessage]);
            mockWorker.setMockUsage(50, 25, 0);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: [],
            };

            await summarizer.summarize(parameters);

            const processedPrompt = mockWorker.getProcessedPrompts()[0];
            expect(processedPrompt).toContain('You are a summarizer');
            expect(processedPrompt).toContain(
                'condense the information provided'
            );
            expect(processedPrompt).toContain(
                'Focus on the key points and main ideas'
            );
            expect(processedPrompt).toContain('avoid unnecessary details');
            expect(processedPrompt).toContain(
                'clear and straightforward language'
            );
        });
    });

    describe('integration with AgentWorker', () => {
        it('should work with worker that has multiple processing steps', async () => {
            // Setup worker to simulate a complex processing scenario
            const intermediateMessage = createMockMessage({
                content: 'Processing...',
            });
            const finalMessage = createMockMessage({
                content: 'Complete summary',
            });

            mockWorker.setShouldYieldMessages([intermediateMessage]);
            mockWorker.setMockMessages([finalMessage]);
            mockWorker.setMockUsage(250, 125, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Complex summarization task',
                messages: [],
            };

            const result = await summarizer.summarize(parameters);

            expect(result.summary).toBe('Complete summary');
            expect(result.messageCount).toBe(1);
            expect(result.usage.inputTokens).toBe(250);
            expect(result.usage.outputTokens).toBe(125);
            expect(result.usage.toolsUsed).toBe(1);
        });
    });
});
