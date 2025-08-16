import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { AgentService } from '../../../src/application/services/agent-service.js';
import { CredentialService } from '../../../src/application/services/credential-service.js';
import { MockConfigStore } from './config-service.mocks.js';
import { MockCredentialStore } from './credential-service.mocks.js';
import { 
  MockAgentFactoryRegistry, 
  MockAgent, 
  MockToolbox,
  createTestAgentMessage 
} from './agent-service.mocks.js';
import { AgentExecutionRequest } from '../../../src/application/interfaces/agent-execution.js';

describe('AgentService', () => {
  let agentService: AgentService;
  let mockConfigReader: MockConfigStore;
  let mockAgentFactory: MockAgentFactoryRegistry;
  let mockCredentialService: CredentialService;
  let mockCredentialStore: MockCredentialStore;
  let mockToolbox: MockToolbox;
  let mockAgent: MockAgent;

  beforeEach(async () => {
    mockConfigReader = new MockConfigStore();
    mockAgentFactory = new MockAgentFactoryRegistry();
    mockCredentialStore = new MockCredentialStore();
    mockCredentialService = new CredentialService();
    mockToolbox = new MockToolbox();
    mockAgent = new MockAgent(
      { model: 'test-model', provider: 'test-provider', apiKey: 'test-key' },
      mockToolbox
    );

    // Replace the credential service methods with mock implementations
    vi.spyOn(mockCredentialService, 'getProviderCredential').mockImplementation(
      (provider: string) => mockCredentialStore.getProviderCredential(provider)
    );

    agentService = new AgentService(
      mockConfigReader,
      mockAgentFactory,
      mockCredentialService as any
    );

    // Set up default worker config
    mockConfigReader.mockConfig.workers['test-worker'] = {
      provider: 'test-provider',
      model: 'test-model',
      temperature: 0.7,
      enabled: true,
      description: 'Test worker for testing'
    };

    // Set up default credentials
    await mockCredentialStore.setProviderCredential('test-provider', {
      apiKey: 'test-api-key',
      lastUsed: new Date().toISOString()
    });

    mockAgentFactory.setMockAgent(mockAgent);
  });

  afterEach(() => {
    mockConfigReader.reset();
    mockAgentFactory.reset();
    mockCredentialStore.reset();
    mockToolbox.reset();
    mockAgent.reset();
  });

  describe('executeAgent', () => {
    it('should successfully execute an agent with valid request', async () => {
      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      const testMessage = createTestAgentMessage('1', 'assistant', 'Test response');
      mockAgent.setMockMessages([testMessage]);

      const execution = await agentService.executeAgent(request, mockToolbox);

      expect(mockAgentFactory.createAgentCalled).toBe(true);
      expect(mockAgent.processStreamCalled).toBe(true);
      expect(mockAgent.lastInput?.messages).toHaveLength(1);
      expect(mockAgent.lastInput?.messages[0].content).toBe('Test prompt');

      // Verify status observable emits (likely 'processing' since it moves quickly)
      const firstStatus = await firstValueFrom(execution.status);
      expect(['starting', 'processing']).toContain(firstStatus.status);
    });

    it('should handle agent execution with system prompt and parameters', async () => {
      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt',
        systemPrompt: 'System instruction',
        temperature: 0.5,
        maxTokens: 1000
      };

      await agentService.executeAgent(request, mockToolbox);

      expect(mockAgent.lastInput?.systemPrompt).toBe('System instruction');
      expect(mockAgent.lastInput?.temperature).toBe(0.5);
      expect(mockAgent.lastInput?.maxTokens).toBe(1000);
    });

    it('should fail when worker not found', async () => {
      const request: AgentExecutionRequest = {
        agentName: 'non-existent-worker',
        prompt: 'Test prompt'
      };

      await expect(agentService.executeAgent(request, mockToolbox))
        .rejects.toThrow("Worker 'non-existent-worker' not found in configuration");
    });

    it('should fail when worker is disabled', async () => {
      mockConfigReader.mockConfig.workers['disabled-worker'] = {
        provider: 'test-provider',
        model: 'test-model',
        temperature: 0.7,
        enabled: false,
        description: 'Disabled worker for testing'
      };

      const request: AgentExecutionRequest = {
        agentName: 'disabled-worker',
        prompt: 'Test prompt'
      };

      await expect(agentService.executeAgent(request, mockToolbox))
        .rejects.toThrow("Worker 'disabled-worker' is disabled");
    });

    it('should fail when no API key found for provider', async () => {
      mockCredentialStore.mockCredentials = {}; // Clear credentials

      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      await expect(agentService.executeAgent(request, mockToolbox))
        .rejects.toThrow("No API key found for provider 'test-provider'");
    });

    it('should create agent with correct configuration', async () => {
      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      await agentService.executeAgent(request, mockToolbox);

      expect(mockAgentFactory.lastConfig).toEqual({
        model: 'test-model',
        provider: 'test-provider',
        apiKey: 'test-api-key',
        temperature: 0.7
      });
      expect(mockAgentFactory.lastToolbox).toBe(mockToolbox);
    });
  });

  describe('getExecutionResult', () => {
    it('should return successful execution result', async () => {
      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      const result = await agentService.getExecutionResult(
        request,
        1500,
        true
      );

      expect(result.success).toBe(true);
      expect(result.summary).toBe('test-worker agent executed successfully');
      expect(result.executionTime).toBe(1500);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.agentName).toBe('test-worker');
      expect(result.metadata!.provider).toBe('test-provider');
      expect(result.metadata!.model).toBe('test-model');
      expect(result.metadata!.temperature).toBe(0.7);
    });

    it('should return failed execution result with error', async () => {
      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      const result = await agentService.getExecutionResult(
        request,
        2000,
        false,
        'Test error message'
      );

      expect(result.success).toBe(false);
      expect(result.summary).toBe('test-worker agent failed: Test error message');
      expect(result.executionTime).toBe(2000);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.agentName).toBe('test-worker');
    });

    it('should handle worker config not found in execution result', async () => {
      const request: AgentExecutionRequest = {
        agentName: 'non-existent-worker',
        prompt: 'Test prompt'
      };

      const result = await agentService.getExecutionResult(
        request,
        1000,
        false,
        'Worker not found'
      );

      expect(result.metadata).toBeDefined();
      expect(result.metadata!.provider).toBeUndefined();
      expect(result.metadata!.model).toBeUndefined();
      expect(result.metadata!.temperature).toBeUndefined();
    });
  });

  describe('Agent creation and configuration', () => {
    it('should use worker temperature when request temperature not provided', async () => {
      mockConfigReader.mockConfig.workers['test-worker'].temperature = 0.9;

      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      await agentService.executeAgent(request, mockToolbox);

      expect(mockAgentFactory.lastConfig?.temperature).toBe(0.9);
    });

    it('should prefer request temperature over worker temperature', async () => {
      mockConfigReader.mockConfig.workers['test-worker'].temperature = 0.9;

      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt',
        temperature: 0.3
      };

      await agentService.executeAgent(request, mockToolbox);

      expect(mockAgent.lastInput?.temperature).toBe(0.3);
    });

    it('should include context messages when provided', async () => {
      const contextMessage = createTestAgentMessage('ctx-1', 'user', 'Context message');
      
      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt',
        context: [contextMessage]
      };

      await agentService.executeAgent(request, mockToolbox);

      expect(mockAgent.lastInput?.messages).toHaveLength(2);
      expect(mockAgent.lastInput?.messages[0]).toBe(contextMessage);
      expect(mockAgent.lastInput?.messages[1].content).toBe('Test prompt');
    });
  });
});