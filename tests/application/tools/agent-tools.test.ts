import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { AgentTools } from '../../../src/application/tools/agent-tools.js';
import { 
  MockAgentService, 
  MockEmbeddingService, 
  MockWorkerToolbox,
  createTestToolCall 
} from './agent-tools.mocks.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';
import { EmbeddingService } from '../../../src/application/interfaces/embedding-service.js';

describe('AgentTools', () => {
  let agentTools: AgentTools;
  let mockAgentService: MockAgentService;
  let mockEmbeddingService: EmbeddingService;
  let mockWorkerToolbox: MockWorkerToolbox;

  beforeEach(() => {
    mockAgentService = new MockAgentService();
    mockEmbeddingService = new MockEmbeddingService();
    mockWorkerToolbox = new MockWorkerToolbox();

    agentTools = new AgentTools(
      mockEmbeddingService,
      mockAgentService,
      mockWorkerToolbox
    );
  });

  afterEach(() => {
    mockAgentService.reset();
    mockWorkerToolbox.reset();
  });

  describe('Initialization', () => {
    it('should initialize with correct id and description', () => {
      expect(agentTools.id).toBe('agent_tools');
      expect(agentTools.description).toBe('Agent execution toolbox for running configured worker agents');
    });

    it('should expose embedding service', () => {
      expect(agentTools.embeddingService).toBe(mockEmbeddingService);
    });

    it('should expose domain messages observable', () => {
      expect(agentTools.domainMessages$).toBeDefined();
    });
  });

  describe('getTools', () => {
    it('should return execute_agent tool definition', () => {
      const tools = agentTools.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('execute_agent');
      expect(tools[0].description).toBe('Execute a configured worker agent with a prompt');
      expect(tools[0].permission).toBe('loose');
      expect(tools[0].parameters).toHaveLength(5);

      // Check required parameters
      const agentNameParam = tools[0].parameters.find(p => p.name === 'agentName');
      const promptParam = tools[0].parameters.find(p => p.name === 'prompt');
      expect(agentNameParam?.required).toBe(true);
      expect(promptParam?.required).toBe(true);

      // Check optional parameters
      const systemPromptParam = tools[0].parameters.find(p => p.name === 'systemPrompt');
      const temperatureParam = tools[0].parameters.find(p => p.name === 'temperature');
      const maxTokensParam = tools[0].parameters.find(p => p.name === 'maxTokens');
      expect(systemPromptParam?.required).toBe(false);
      expect(temperatureParam?.required).toBe(false);
      expect(maxTokensParam?.required).toBe(false);
    });
  });

  describe('supportsTool', () => {
    it('should support execute_agent tool', () => {
      expect(agentTools.supportsTool('execute_agent')).toBe(true);
    });

    it('should not support other tools', () => {
      expect(agentTools.supportsTool('other_tool')).toBe(false);
      expect(agentTools.supportsTool('invalid_tool')).toBe(false);
    });
  });

  describe('executeTool', () => {
    it('should successfully execute agent with valid parameters', async () => {
      const toolCall = createTestToolCall('execute_agent', {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      });

      const result = await agentTools.executeTool(toolCall);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.message).toContain('test-worker agent executed successfully');
      
      expect(mockAgentService.executeAgentCalled).toBe(true);
      expect(mockAgentService.getExecutionResultCalled).toBe(true);
      expect(mockAgentService.lastRequest?.agentName).toBe('test-worker');
      expect(mockAgentService.lastRequest?.prompt).toBe('Test prompt');
      expect(mockAgentService.lastToolbox).toBe(mockWorkerToolbox);
    });

    it('should execute agent with all optional parameters', async () => {
      const toolCall = createTestToolCall('execute_agent', {
        agentName: 'test-worker',
        prompt: 'Test prompt',
        systemPrompt: 'System instruction',
        temperature: 0.8,
        maxTokens: 2000
      });

      await agentTools.executeTool(toolCall);

      expect(mockAgentService.lastRequest?.systemPrompt).toBe('System instruction');
      expect(mockAgentService.lastRequest?.temperature).toBe(0.8);
      expect(mockAgentService.lastRequest?.maxTokens).toBe(2000);
    });

    it('should emit domain messages during execution', async () => {
      const toolCall = createTestToolCall('execute_agent', {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      });

      const messagePromise = firstValueFrom(
        agentTools.domainMessages$.pipe(take(3), toArray())
      );

      await agentTools.executeTool(toolCall);

      const messages = await messagePromise;
      expect(messages).toHaveLength(3);
      
      expect(messages[0].content).toContain('Starting test-worker agent');
      expect(messages[1].content).toContain('Agent Status');
      expect(messages[2].content).toContain('Agent execution completed');
    });

    it('should handle agent execution errors gracefully', async () => {
      const errorMessage = 'Agent execution failed';
      mockAgentService.simulateError(errorMessage);

      const toolCall = createTestToolCall('execute_agent', {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      });

      const result = await agentTools.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toContain(errorMessage);
      expect(result.data.success).toBe(false);
      expect(result.data.summary).toContain('Agent execution failed');
    });

    it('should fail for unsupported tools', async () => {
      const toolCall = createTestToolCall('unsupported_tool', {});

      const result = await agentTools.executeTool(toolCall);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Tool 'unsupported_tool' is not supported by AgentTools");
    });

    describe('Parameter validation', () => {
      it('should fail when agentName is missing', async () => {
        const toolCall = createTestToolCall('execute_agent', {
          prompt: 'Test prompt'
        });

        const result = await agentTools.executeTool(toolCall);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Agent name is required and must be a string');
      });

      it('should fail when agentName is not a string', async () => {
        const toolCall = createTestToolCall('execute_agent', {
          agentName: 123,
          prompt: 'Test prompt'
        });

        const result = await agentTools.executeTool(toolCall);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Agent name is required and must be a string');
      });

      it('should fail when prompt is missing', async () => {
        const toolCall = createTestToolCall('execute_agent', {
          agentName: 'test-worker'
        });

        const result = await agentTools.executeTool(toolCall);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Prompt is required and must be a string');
      });

      it('should fail when prompt is not a string', async () => {
        const toolCall = createTestToolCall('execute_agent', {
          agentName: 'test-worker',
          prompt: 123
        });

        const result = await agentTools.executeTool(toolCall);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Prompt is required and must be a string');
      });

      it('should fail when systemPrompt is not a string', async () => {
        const toolCall = createTestToolCall('execute_agent', {
          agentName: 'test-worker',
          prompt: 'Test prompt',
          systemPrompt: 123
        });

        const result = await agentTools.executeTool(toolCall);

        expect(result.success).toBe(false);
        expect(result.error).toBe('System prompt must be a string');
      });

      it('should fail when temperature is out of range', async () => {
        const toolCall = createTestToolCall('execute_agent', {
          agentName: 'test-worker',
          prompt: 'Test prompt',
          temperature: 3.0
        });

        const result = await agentTools.executeTool(toolCall);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Temperature must be a number between 0 and 2');
      });

      it('should fail when temperature is negative', async () => {
        const toolCall = createTestToolCall('execute_agent', {
          agentName: 'test-worker',
          prompt: 'Test prompt',
          temperature: -0.5
        });

        const result = await agentTools.executeTool(toolCall);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Temperature must be a number between 0 and 2');
      });

      it('should fail when maxTokens is not positive', async () => {
        const toolCall = createTestToolCall('execute_agent', {
          agentName: 'test-worker',
          prompt: 'Test prompt',
          maxTokens: 0
        });

        const result = await agentTools.executeTool(toolCall);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Max tokens must be a positive number');
      });

      it('should accept valid parameter ranges', async () => {
        const toolCall = createTestToolCall('execute_agent', {
          agentName: 'test-worker',
          prompt: 'Test prompt',
          temperature: 1.5,
          maxTokens: 1000
        });

        const result = await agentTools.executeTool(toolCall);

        expect(result.success).toBe(true);
      });
    });
  });
});