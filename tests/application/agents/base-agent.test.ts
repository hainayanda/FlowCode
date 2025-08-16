import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAgent } from '../../../src/application/agents/base-agent.js';
import { AgentResponse } from '../../../src/application/interfaces/agent.js';
import { MockAgent, MockToolbox, createMockAgentConfig } from './base-agent.mocks.js';

describe('BaseAgent', () => {
  let agent: MockAgent;
  let toolbox: MockToolbox;

  beforeEach(() => {
    toolbox = new MockToolbox();
    agent = new MockAgent(createMockAgentConfig(), toolbox);
  });

  describe('constructor', () => {
    it('should initialize with config and toolbox', () => {
      expect(agent.getProvider()).toBe('mock-provider');
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', async () => {
      const result = await agent.validateConfig();
      expect(result).toBe(true);
    });

    it('should return false when apiKey is missing', async () => {
      const invalidConfig = { ...createMockAgentConfig(), apiKey: '' };
      const invalidAgent = new MockAgent(invalidConfig, toolbox);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false when model is missing', async () => {
      const invalidConfig = { ...createMockAgentConfig(), model: '' };
      const invalidAgent = new MockAgent(invalidConfig, toolbox);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false when provider is missing', async () => {
      const invalidConfig = { ...createMockAgentConfig(), provider: '' };
      const invalidAgent = new MockAgent(invalidConfig, toolbox);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return the provider from config', () => {
      expect(agent.getProvider()).toBe('mock-provider');
    });
  });

  describe('generateMessageId', () => {
    it('should generate unique message IDs', () => {
      const id1 = agent['generateMessageId']();
      const id2 = agent['generateMessageId']();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_\d+_[a-z0-9]{9}$/);
      expect(id2).toMatch(/^msg_\d+_[a-z0-9]{9}$/);
    });
  });

  describe('getCurrentTimestamp', () => {
    it('should return a Date object', () => {
      const timestamp = agent['getCurrentTimestamp']();
      expect(timestamp).toBeInstanceOf(Date);
    });

    it('should return current time within reasonable bounds', () => {
      const before = new Date();
      const timestamp = agent['getCurrentTimestamp']();
      const after = new Date();
      
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('parseMultiMessages', () => {
    it('should parse message with --MESSAGE-- marker', () => {
      const content = '--MESSAGE--\nThis is a regular message.';
      const result = agent['parseMultiMessages'](content);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        type: 'assistant',
        content: 'This is a regular message.'
      });
      expect(result.isComplete).toBe(false);
      expect(result.summaryData).toBeUndefined();
    });

    it('should parse message with --THINKING-- marker', () => {
      const content = '--THINKING--\nI need to analyze this problem.';
      const result = agent['parseMultiMessages'](content);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        type: 'thinking',
        content: 'I need to analyze this problem.'
      });
      expect(result.isComplete).toBe(false);
    });

    it('should parse message with --SUMMARY-- marker and mark as complete', () => {
      const content = '--SUMMARY--\nTask completed successfully.';
      const result = agent['parseMultiMessages'](content);

      expect(result.messages).toHaveLength(0);
      expect(result.isComplete).toBe(true);
      expect(result.summaryData).toBe('Task completed successfully.');
    });

    it('should handle content before first marker', () => {
      const content = 'Some initial content\n--MESSAGE--\nMarked content';
      const result = agent['parseMultiMessages'](content);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({
        type: 'assistant',
        content: 'Some initial content'
      });
      expect(result.messages[1]).toEqual({
        type: 'assistant',
        content: 'Marked content'
      });
    });

    it('should handle multiple markers correctly', () => {
      const content = '--MESSAGE--\nFirst message\n--THINKING--\nSome thinking\n--MESSAGE--\nSecond message';
      const result = agent['parseMultiMessages'](content);

      expect(result.messages).toHaveLength(3);
      expect(result.messages[0]).toEqual({
        type: 'assistant',
        content: 'First message'
      });
      expect(result.messages[1]).toEqual({
        type: 'thinking',
        content: 'Some thinking'
      });
      expect(result.messages[2]).toEqual({
        type: 'assistant',
        content: 'Second message'
      });
      expect(result.isComplete).toBe(false);
    });

    it('should stop parsing at --SUMMARY-- marker', () => {
      const content = '--MESSAGE--\nRegular message\n--SUMMARY--\nTask done\n--MESSAGE--\nShould not be parsed';
      const result = agent['parseMultiMessages'](content);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        type: 'assistant',
        content: 'Regular message'
      });
      expect(result.isComplete).toBe(true);
      expect(result.summaryData).toBe('Task done');
    });

    it('should handle content with no markers', () => {
      const content = 'Just some plain content without markers';
      const result = agent['parseMultiMessages'](content);

      expect(result.messages).toHaveLength(0);
      expect(result.isComplete).toBe(false);
      expect(result.remainingContent).toBe('Just some plain content without markers');
    });

    it('should handle empty content', () => {
      const content = '';
      const result = agent['parseMultiMessages'](content);

      expect(result.messages).toHaveLength(0);
      expect(result.isComplete).toBe(false);
      expect(result.remainingContent).toBe('');
    });
  });

  describe('getMultiMessagePrompt', () => {
    it('should return the multi-message prompt instructions', () => {
      const prompt = agent['getMultiMessagePrompt']();
      
      expect(prompt).toContain('ITERATIVE MULTI-MESSAGE MODE');
      expect(prompt).toContain('--MESSAGE--');
      expect(prompt).toContain('--THINKING--');
      expect(prompt).toContain('--SUMMARY--');
      expect(prompt).toContain('Send ONLY ONE message marker per response');
    });
  });

  describe('processStreamWithIteration', () => {
    beforeEach(() => {
      agent.reset();
    });

    it('should complete on first iteration when summary is provided', async () => {
      const summaryResponse: AgentResponse = {
        message: {
          id: 'summary-id',
          type: 'assistant',
          content: '--SUMMARY--\nTask completed successfully.',
          timestamp: new Date()
        }
      };
      
      agent.setMockResponses([summaryResponse]);
      
      const input = { 
        messages: [{ id: '1', type: 'user' as const, content: 'Test', timestamp: new Date() }] 
      };
      
      const responses: AgentResponse[] = [];
      
      await new Promise<void>((resolve) => {
        agent.processStreamWithIteration(input).subscribe({
          next: (response) => responses.push(response),
          complete: () => resolve()
        });
      });

      expect(agent.processStreamCallCount).toBe(1);
      expect(responses).toHaveLength(2); // Original response + summary message
      expect(responses[1].message.type).toBe('summary');
      expect(responses[1].summaryData).toBe('Task completed successfully.');
    });

    it('should iterate multiple times until summary is found', async () => {
      const messageResponse1: AgentResponse = {
        message: {
          id: 'msg-1',
          type: 'assistant',
          content: '--MESSAGE--\nWorking on the task.',
          timestamp: new Date()
        }
      };
      
      const thinkingResponse: AgentResponse = {
        message: {
          id: 'thinking-1',
          type: 'assistant',
          content: '--THINKING--\nAnalyzing the problem.',
          timestamp: new Date()
        }
      };
      
      const summaryResponse: AgentResponse = {
        message: {
          id: 'summary-1',
          type: 'assistant',
          content: '--SUMMARY--\nTask completed.',
          timestamp: new Date()
        }
      };
      
      agent.setMockResponses([messageResponse1, thinkingResponse, summaryResponse]);
      
      const input = { 
        messages: [{ id: '1', type: 'user' as const, content: 'Test', timestamp: new Date() }] 
      };
      
      const responses: AgentResponse[] = [];
      
      await new Promise<void>((resolve) => {
        agent.processStreamWithIteration(input).subscribe({
          next: (response) => responses.push(response),
          complete: () => resolve()
        });
      });

      expect(agent.processStreamCallCount).toBe(3);
      expect(responses).toHaveLength(4); // 3 original + 1 summary message
      expect(responses[3].message.type).toBe('summary');
      expect(responses[3].summaryData).toBe('Task completed.');
    });

    it('should stop at max iterations if no summary is provided', async () => {
      const config = { ...createMockAgentConfig(), maxIterations: 2 };
      const limitedAgent = new MockAgent(config, toolbox);
      
      const messageResponse: AgentResponse = {
        message: {
          id: 'msg-1',
          type: 'assistant',
          content: '--MESSAGE--\nStill working...',
          timestamp: new Date()
        }
      };
      
      limitedAgent.setMockResponses([messageResponse]);
      
      const input = { 
        messages: [{ id: '1', type: 'user' as const, content: 'Test', timestamp: new Date() }] 
      };
      
      const responses: AgentResponse[] = [];
      
      await new Promise<void>((resolve) => {
        limitedAgent.processStreamWithIteration(input).subscribe({
          next: (response) => responses.push(response),
          complete: () => resolve()
        });
      });

      expect(limitedAgent.processStreamCallCount).toBe(2);
      expect(responses[responses.length - 1].message.type).toBe('summary');
      expect((responses[responses.length - 1].message as any).taskStatus).toBe('partial');
      expect(responses[responses.length - 1].finishReason).toBe('length');
    });

    it('should include multi-message prompt in system prompt unless disabled', async () => {
      const summaryResponse: AgentResponse = {
        message: {
          id: 'summary-id',
          type: 'assistant',
          content: '--SUMMARY--\nDone.',
          timestamp: new Date()
        }
      };
      
      agent.setMockResponses([summaryResponse]);
      
      const input = { 
        messages: [{ id: '1', type: 'user' as const, content: 'Test', timestamp: new Date() }],
        systemPrompt: 'Original prompt'
      };
      
      await new Promise<void>((resolve) => {
        agent.processStreamWithIteration(input).subscribe({
          complete: () => resolve()
        });
      });

      expect(agent.lastInput?.systemPrompt).toContain('Original prompt');
      expect(agent.lastInput?.systemPrompt).toContain('ITERATIVE MULTI-MESSAGE MODE');
    });

    it('should not add multi-message prompt when disabled', async () => {
      const summaryResponse: AgentResponse = {
        message: {
          id: 'summary-id',
          type: 'assistant',
          content: '--SUMMARY--\nDone.',
          timestamp: new Date()
        }
      };
      
      agent.setMockResponses([summaryResponse]);
      
      const input = { 
        messages: [{ id: '1', type: 'user' as const, content: 'Test', timestamp: new Date() }],
        systemPrompt: 'Original prompt',
        disableMultiMessage: true
      };
      
      await new Promise<void>((resolve) => {
        agent.processStreamWithIteration(input).subscribe({
          complete: () => resolve()
        });
      });

      expect(agent.lastInput?.systemPrompt).toBe('Original prompt');
      expect(agent.lastInput?.systemPrompt).not.toContain('ITERATIVE MULTI-MESSAGE MODE');
    });
  });

  describe('concurrent iteration handling', () => {
    beforeEach(() => {
      agent.reset();
    });

    it('should handle single input correctly', async () => {
      const summaryResponse: AgentResponse = {
        message: {
          id: 'summary-id',
          type: 'assistant',
          content: '--SUMMARY--\nCompleted task.',
          timestamp: new Date()
        }
      };
      
      agent.setMockResponses([summaryResponse]);
      
      const input = { 
        messages: [{ id: '1', type: 'user' as const, content: 'Test message', timestamp: new Date() }] 
      };

      const responses: AgentResponse[] = [];
      
      await new Promise<void>((resolve) => {
        agent.processStreamWithIteration(input).subscribe({
          next: (response) => responses.push(response),
          complete: () => resolve()
        });
      });

      // Should have processed the input
      expect(agent.processStreamCallCount).toBe(1);
      expect(responses.length).toBeGreaterThan(0);
    });

    it('should expose isInIteration status', async () => {
      expect(agent.isInIteration).toBe(false);
      
      const summaryResponse: AgentResponse = {
        message: {
          id: 'summary-id',
          type: 'assistant',
          content: '--SUMMARY--\nCompleted task.',
          timestamp: new Date()
        }
      };
      
      agent.setMockResponses([summaryResponse]);
      
      const input = { 
        messages: [{ id: '1', type: 'user' as const, content: 'Test message', timestamp: new Date() }] 
      };

      const promise = new Promise<void>((resolve) => {
        agent.processStreamWithIteration(input).subscribe({
          complete: () => {
            // Add a small delay to ensure the finally block has executed
            setTimeout(() => resolve(), 10);
          }
        });
      });

      await promise;
      expect(agent.isInIteration).toBe(false);
    });

    it('should allow queuing inputs', () => {
      const input1 = { 
        messages: [{ id: '1', type: 'user' as const, content: 'First message', timestamp: new Date() }] 
      };

      const input2 = { 
        messages: [{ id: '2', type: 'user' as const, content: 'Second message', timestamp: new Date() }] 
      };

      expect(agent.getQueuedInputs()).toHaveLength(0);
      
      agent.queueProcess(input1);
      agent.queueProcess(input2);
      
      expect(agent.getQueuedInputs()).toHaveLength(2);
      expect(agent.getQueuedInputs(true)).toHaveLength(2);
      expect(agent.getQueuedInputs()).toHaveLength(0); // Should be cleared
    });

    it('should merge multiple inputs correctly', () => {
      const input1 = { 
        messages: [{ id: '1', type: 'user' as const, content: 'First message', timestamp: new Date() }],
        systemPrompt: 'Original prompt',
        temperature: 0.5
      };

      const input2 = { 
        messages: [{ id: '2', type: 'user' as const, content: 'Second message', timestamp: new Date() }],
        systemPrompt: 'Updated prompt',
        maxTokens: 2000
      };

      const merged = agent.mergeInputs([input1, input2]);
      
      expect(merged.messages).toHaveLength(2);
      expect(merged.messages[0].content).toBe('First message');
      expect(merged.messages[1].content).toBe('Second message');
      expect(merged.systemPrompt).toBe('Updated prompt');
      expect(merged.temperature).toBe(0.5);
      expect(merged.maxTokens).toBe(2000);
    });

    it('should queue new inputs when iteration is already running', async () => {
      const firstResponse: AgentResponse = {
        message: {
          id: 'first-msg',
          type: 'assistant',
          content: '--SUMMARY--\nCompleted first iteration.',
          timestamp: new Date()
        }
      };

      agent.setMockResponses([firstResponse]);

      const firstInput = { 
        messages: [{ id: '1', type: 'user' as const, content: 'First call', timestamp: new Date() }] 
      };

      const secondInput = { 
        messages: [{ id: '2', type: 'user' as const, content: 'Second call', timestamp: new Date() }] 
      };

      // Start first iteration
      const firstPromise = new Promise<void>((resolve) => {
        agent.processStreamWithIteration(firstInput).subscribe({
          complete: () => setTimeout(() => resolve(), 10)
        });
      });

      // Queue second input manually to simulate concurrent behavior
      agent.queueProcess(secondInput);
      expect(agent.getQueuedInputs()).toHaveLength(1);

      await firstPromise;
      
      // Now process the queued input
      const queuedInputs = agent.getQueuedInputs(true);
      expect(queuedInputs).toHaveLength(1);
      expect(queuedInputs[0]).toBe(secondInput);
    });

    it('should queue second input for later processing', async () => {
      const messageResponse: AgentResponse = {
        message: {
          id: 'msg-1',
          type: 'assistant',
          content: '--SUMMARY--\nCompleted first iteration.',
          timestamp: new Date()
        }
      };

      agent.setMockResponses([messageResponse]);

      const firstInput = { 
        messages: [{ id: '1', type: 'user' as const, content: 'First message', timestamp: new Date() }] 
      };

      const secondInput = { 
        messages: [{ id: '2', type: 'user' as const, content: 'Second message', timestamp: new Date() }] 
      };

      // Process first input
      await new Promise<void>((resolve) => {
        agent.processStreamWithIteration(firstInput).subscribe({
          complete: () => setTimeout(() => resolve(), 10)
        });
      });

      // Queue second input for later processing
      agent.queueProcess(secondInput);
      expect(agent.getQueuedInputs()).toHaveLength(1);

      // Verify we can retrieve and clear the queue
      const queuedInputs = agent.getQueuedInputs(true);
      expect(queuedInputs).toHaveLength(1);
      expect(queuedInputs[0]).toBe(secondInput);
      expect(agent.getQueuedInputs()).toHaveLength(0); // Queue should be cleared
    });

    it('should process inputs with different system prompts sequentially', async () => {
      const firstInput = { 
        messages: [{ id: '1', type: 'user' as const, content: 'First', timestamp: new Date() }],
        systemPrompt: 'Original prompt'
      };

      const secondInput = { 
        messages: [{ id: '2', type: 'user' as const, content: 'Second', timestamp: new Date() }],
        systemPrompt: 'Updated prompt'
      };

      // Queue multiple inputs with different system prompts
      agent.queueProcess(firstInput);
      agent.queueProcess(secondInput);

      const queuedInputs = agent.getQueuedInputs();
      expect(queuedInputs).toHaveLength(2);
      expect(queuedInputs[0].systemPrompt).toBe('Original prompt');
      expect(queuedInputs[1].systemPrompt).toBe('Updated prompt');

      // Test merging inputs with different system prompts
      const mergedInput = agent.mergeInputs(queuedInputs);
      expect(mergedInput.systemPrompt).toBe('Updated prompt'); // Should use latest
      expect(mergedInput.messages).toHaveLength(2);
    });

    it('should queue inputs with different configurations', async () => {
      const firstInput = { 
        messages: [{ id: '1', type: 'user' as const, content: 'First', timestamp: new Date() }],
        temperature: 0.5,
        maxTokens: 1000
      };

      const secondInput = { 
        messages: [{ id: '2', type: 'user' as const, content: 'Second', timestamp: new Date() }],
        temperature: 0.8,
        maxTokens: 2000
      };

      // Queue inputs with different configurations
      agent.queueProcess(firstInput);
      agent.queueProcess(secondInput);

      const queuedInputs = agent.getQueuedInputs();
      expect(queuedInputs).toHaveLength(2);

      // Test merging inputs with different configurations
      const mergedInput = agent.mergeInputs(queuedInputs);
      expect(mergedInput.temperature).toBe(0.8); // Should use latest (second has temperature)
      expect(mergedInput.maxTokens).toBe(2000); // Should use latest
      expect(mergedInput.messages).toHaveLength(2);
    });

    it('should handle queued inputs with different tools', async () => {
      const firstTools = [
        { name: 'tool1', description: 'First tool', parameters: {} }
      ];

      const secondTools = [
        { name: 'tool2', description: 'Second tool', parameters: {} }
      ];

      const firstInput = { 
        messages: [{ id: '1', type: 'user' as const, content: 'First', timestamp: new Date() }],
        tools: firstTools
      };

      const secondInput = { 
        messages: [{ id: '2', type: 'user' as const, content: 'Second', timestamp: new Date() }],
        tools: secondTools
      };

      // Queue inputs with different tools
      agent.queueProcess(firstInput);
      agent.queueProcess(secondInput);

      const queuedInputs = agent.getQueuedInputs();
      expect(queuedInputs).toHaveLength(2);

      // Test merging inputs with different tools
      const mergedInput = agent.mergeInputs(queuedInputs);
      expect(mergedInput.tools).toBe(secondTools); // Should use latest tools
      expect(mergedInput.messages).toHaveLength(2);
    });
  });
});