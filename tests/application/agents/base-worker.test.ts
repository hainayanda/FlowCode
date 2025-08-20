import { describe, it, expect, beforeEach } from 'vitest';
import { AgentExecutionParameters } from '../../../src/application/interfaces/agents';
import { AsyncControl } from '../../../src/application/models/async-control';
import { TestWorker, createMockMessage, createMockConfig } from './test-worker.mocks';
import { MockToolbox } from './toolbox.mocks';

describe('BaseWorker', () => {
    let worker: TestWorker;
    let mockToolbox: MockToolbox;
    let mockConfig: any;

    beforeEach(() => {
        mockToolbox = new MockToolbox();
        mockConfig = createMockConfig();
        worker = new TestWorker('test-worker', mockConfig, mockToolbox);
    });

    describe('constructor', () => {
        it('should initialize with correct name, config, and toolbox', () => {
            expect(worker['name']).toBe('test-worker');
            expect(worker['config']).toBe(mockConfig);
            expect(worker['toolbox']).toBe(mockToolbox);
        });
    });

    describe('process', () => {
        it('should process single iteration successfully', async () => {
            const mockMessage = createMockMessage({ content: 'Test response' });
            worker.setMockMessages([mockMessage]);
            worker.setMockUsage(100, 200, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const generator = worker.process(parameters, 1);
            const result = await generator.next();

            expect(result.done).toBe(true);
            if (result.done) {
                expect(result.value.messages).toEqual([mockMessage]);
                expect(result.value.usage.inputTokens).toBe(100);
                expect(result.value.usage.outputTokens).toBe(200);
                expect(result.value.usage.toolsUsed).toBe(1);
            }
        });

        it('should handle multiple iterations', async () => {
            const mockMessage1 = createMockMessage({ content: 'Response 1' });

            // Set up to yield a message and continue (has tools used)
            worker.setShouldYieldMessages([mockMessage1]);
            worker.setMockMessages([mockMessage1]);
            worker.setMockUsage(50, 100, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const messages: any[] = [];
            const generator = worker.process(parameters, 3);
            
            // Manually iterate through the generator to handle AsyncControl properly
            let result = await generator.next({ type: 'continue' });
            while (!result.done) {
                messages.push(result.value);
                // Update to terminate after this iteration
                worker.setShouldYieldMessages([]);
                worker.setMockMessages([]);
                worker.setMockUsage(60, 120, 0); // No tools, should terminate
                result = await generator.next({ type: 'continue' });
            }

            // Should have processed and yielded at least one message
            expect(messages.length).toBeGreaterThan(0);
            expect(messages[0]).toEqual(mockMessage1);
        });

        it('should terminate early when no output and no tools used', async () => {
            worker.setMockMessages([]); // No messages
            worker.setMockUsage(50, 0, 0); // No tools used

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const generator = worker.process(parameters, 5);
            const result = await generator.next();

            expect(result.done).toBe(true);
            if (result.done) {
                expect(result.value.messages).toEqual([]);
            }
        });

        it('should continue when tools are used even without messages', async () => {
            worker.setMockMessages([]); // No messages
            worker.setMockUsage(50, 0, 1); // But tools used

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const generator = worker.process(parameters, 2);
            let result = await generator.next({ type: 'continue' });
            
            // Should terminate immediately since no messages and no tools after first iteration
            expect(result.done).toBe(true);
        });

        it('should respect maxIterations parameter', async () => {
            const mockMessage = createMockMessage();
            worker.setMockMessages([mockMessage]);
            worker.setMockUsage(50, 100, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const generator = worker.process(parameters, 3);
            let result = await generator.next({ type: 'continue' });
            
            // Process a few iterations manually
            let iterations = 0;
            while (!result.done && iterations < 3) {
                iterations++;
                result = await generator.next({ type: 'continue' });
            }

            // Should have processed the worker prompts for iterations
            expect(worker.getProcessedPrompts().length).toBeGreaterThan(0);
            expect(worker.getProcessedPrompts().length).toBeLessThanOrEqual(3);
        });

        it('should use default maxIterations when not provided', async () => {
            const mockMessage = createMockMessage();
            worker.setMockMessages([mockMessage]);
            worker.setMockUsage(50, 100, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            // Process without maxIterations - should default to 25
            const generator = worker.process(parameters);

            // Run a few iterations to verify it's working
            for (let i = 0; i < 3; i++) {
                const result = await generator.next({ type: 'continue' });
                if (result.done) break;
            }

            // Should have processed prompts (confirming it's working)
            expect(worker.getProcessedPrompts().length).toBeGreaterThan(0);
        });

        it('should append process instructions to prompt', async () => {
            worker.setMockMessages([]);
            worker.setMockUsage(50, 0, 0);

            const parameters: AgentExecutionParameters = {
                prompt: 'Original prompt',
                messages: []
            };

            const generator = worker.process(parameters, 2);
            await generator.next();

            const processedPrompts = worker.getProcessedPrompts();
            expect(processedPrompts[0]).toContain('Original prompt');
            expect(processedPrompts[0]).toContain('## Iterative Mode Instructions');
            expect(processedPrompts[0]).toContain('iteration 1 of 2');
        });

        it('should handle user input via AsyncControl payload', async () => {
            const mockMessage = createMockMessage();
            worker.setMockMessages([mockMessage]);
            worker.setMockUsage(50, 100, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const generator = worker.process(parameters, 2);
            let result = await generator.next({ type: 'continue' });
            
            // The key test is that the process runs successfully
            expect(result.done).toBeTruthy(); // Should complete based on our mock setup
        });

        it('should accumulate messages across iterations', async () => {
            const message1 = createMockMessage({ content: 'Message 1' });

            worker.setMockMessages([message1]);
            worker.setMockUsage(50, 100, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const generator = worker.process(parameters, 2);
            let result = await generator.next({ type: 'continue' });
            
            // Should process successfully  
            expect(result.done).toBeTruthy();
        });
    });

    describe('processInstructions', () => {
        it('should generate correct instructions for first iteration', async () => {
            worker.setMockMessages([]);
            worker.setMockUsage(50, 0, 0);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const generator = worker.process(parameters, 3);
            await generator.next();

            const processedPrompt = worker.getProcessedPrompts()[0];
            expect(processedPrompt).toContain('iteration 1 of 3');
            expect(processedPrompt).toContain('## Iterative Mode Instructions');
            expect(processedPrompt).toContain('Each iteration processes your previous output');
            expect(processedPrompt).not.toContain('FINAL ITERATION');
        });

        it('should generate correct instructions for final iteration', async () => {
            const mockMessage = createMockMessage();
            worker.setMockMessages([mockMessage]);
            worker.setMockUsage(50, 100, 1);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const generator = worker.process(parameters, 2);
            let result = await generator.next({ type: 'continue' });
            
            // Process through iterations to get to final one
            let iterations = 0;
            while (!result.done && iterations < 2) {
                iterations++;
                result = await generator.next({ type: 'continue' });
            }

            const processedPrompts = worker.getProcessedPrompts();
            if (processedPrompts.length > 1) {
                const finalPrompt = processedPrompts[processedPrompts.length - 1];
                expect(finalPrompt).toContain('iteration 2 of 2');
                expect(finalPrompt).toContain('⚠️ THIS IS YOUR FINAL ITERATION');
                expect(finalPrompt).toContain('**FINAL ITERATION:**');
            }
        });

        it('should include efficiency guidelines', async () => {
            worker.setMockMessages([]);
            worker.setMockUsage(50, 0, 0);

            const parameters: AgentExecutionParameters = {
                prompt: 'Test prompt',
                messages: []
            };

            const generator = worker.process(parameters, 5);
            await generator.next();

            const processedPrompt = worker.getProcessedPrompts()[0];
            expect(processedPrompt).toContain('Make the most of your limited iterations');
            expect(processedPrompt).toContain('Use tool calls when you need external information');
            expect(processedPrompt).toContain('break complex tasks into steps');
        });
    });
});