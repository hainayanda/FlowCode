import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { AgentService } from '../../../src/application/services/agent-service.js';
import { CredentialRepository } from '../../../src/application/stores/credential-repository.js';
import { MockConfigStore } from './config-service.mocks.js';
import { MockCredentialStore } from '../stores/credential-repository.mocks.js';
import { 
  MockAgentFactoryRegistry, 
  MockAgent, 
  MockToolbox,
  createTestAgentMessage 
} from './agent-service.mocks.js';
import { AgentExecutionRequest } from '../../../src/application/interfaces/agent-executor.js';
import { DomainMessage } from '../../../src/presentation/view-models/console/console-use-case.js';

describe('AgentService', () => {
  let agentService: AgentService;
  let mockConfigReader: MockConfigStore;
  let mockAgentFactory: MockAgentFactoryRegistry;
  let mockCredentialRepository: CredentialRepository;
  let mockCredentialStore: MockCredentialStore;
  let mockToolbox: MockToolbox;
  let mockAgent: MockAgent;

  beforeEach(async () => {
    mockConfigReader = new MockConfigStore();
    mockAgentFactory = new MockAgentFactoryRegistry();
    mockCredentialStore = new MockCredentialStore();
    mockCredentialRepository = new CredentialRepository();
    mockToolbox = new MockToolbox();
    mockAgent = new MockAgent(
      { model: 'test-model', provider: 'test-provider', apiKey: 'test-key' },
      mockToolbox
    );

    // Replace the credential repository methods with mock implementations
    vi.spyOn(mockCredentialRepository, 'getProviderCredential').mockImplementation(
      (provider: string) => mockCredentialStore.getProviderCredential(provider)
    );

    agentService = new AgentService(
      mockConfigReader,
      mockAgentFactory,
      mockCredentialRepository as any
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

      const execution$ = agentService.executeAgent(request, mockToolbox);

      // Verify we get domain messages
      const firstDomainMessage = await firstValueFrom(execution$);
      expect(firstDomainMessage.type).toBe('system');
      expect(firstDomainMessage.content).toContain('Starting test-worker agent');

      // Wait a bit for async execution and then check mock calls
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockAgentFactory.createAgentCalled).toBe(true);
      expect(mockAgent.processStreamWithIterationCalled).toBe(true);
      expect(mockAgent.lastInput?.messages).toHaveLength(1);
      expect(mockAgent.lastInput?.messages[0].content).toBe('Test prompt');
    });

    it('should get worker prompt from markdown file and use worker config', async () => {
      // Mock worker prompt from markdown
      mockConfigReader.getWorkerPromptReturn = 'You are a test worker from markdown file';
      
      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      const execution$ = agentService.executeAgent(request, mockToolbox);

      // Collect first message to trigger the execution
      await firstValueFrom(execution$);
      
      // Wait a bit for async execution
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAgent.lastInput?.systemPrompt).toBe('You are a test worker from markdown file');
      expect(mockConfigReader.getWorkerPromptCalled).toBe(true);
      expect(mockConfigReader.lastWorkerName).toBe('test-worker');
    });

    it('should fail when worker not found', async () => {
      const request: AgentExecutionRequest = {
        agentName: 'non-existent-worker',
        prompt: 'Test prompt'
      };

      const execution$ = agentService.executeAgent(request, mockToolbox);

      const errorMessage = await firstValueFrom(execution$);
      expect(errorMessage.type).toBe('system');
      expect(errorMessage.content).toContain("Worker 'non-existent-worker' not found in configuration");
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

      const execution$ = agentService.executeAgent(request, mockToolbox);

      const errorMessage = await firstValueFrom(execution$);
      expect(errorMessage.type).toBe('system');
      expect(errorMessage.content).toContain("Worker 'disabled-worker' is disabled");
    });

    it('should fail when no API key found for provider', async () => {
      mockCredentialStore.mockCredentials = {}; // Clear credentials

      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      const execution$ = agentService.executeAgent(request, mockToolbox);

      const errorMessage = await firstValueFrom(execution$);
      expect(errorMessage.type).toBe('system');
      expect(errorMessage.content).toContain("No API key found for provider 'test-provider'");
    });

    it('should create agent with correct configuration', async () => {
      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      const execution$ = agentService.executeAgent(request, mockToolbox);

      // Collect first message to trigger the execution
      await firstValueFrom(execution$);
      
      // Wait a bit for async execution
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAgentFactory.lastConfig).toEqual({
        model: 'test-model',
        provider: 'test-provider',
        apiKey: 'test-api-key',
        temperature: 0.7
      });
      expect(mockAgentFactory.lastToolbox).toBe(mockToolbox);
    });
  });


  describe('Agent creation and configuration', () => {
    it('should use worker temperature when request temperature not provided', async () => {
      mockConfigReader.mockConfig.workers['test-worker'].temperature = 0.9;

      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      const execution$ = agentService.executeAgent(request, mockToolbox);

      // Collect first message to trigger the execution
      await firstValueFrom(execution$);
      
      // Wait a bit for async execution
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAgentFactory.lastConfig?.temperature).toBe(0.9);
    });

    it('should use worker temperature from config for agent creation', async () => {
      mockConfigReader.mockConfig.workers['test-worker'].temperature = 0.9;

      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt'
      };

      const execution$ = agentService.executeAgent(request, mockToolbox);

      // Collect first message to trigger the execution
      await firstValueFrom(execution$);
      
      // Wait a bit for async execution
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAgentFactory.lastConfig?.temperature).toBe(0.9);
    });

    it('should include context messages when provided', async () => {
      const contextMessage = createTestAgentMessage('ctx-1', 'user', 'Context message');
      
      const request: AgentExecutionRequest = {
        agentName: 'test-worker',
        prompt: 'Test prompt',
        context: [contextMessage]
      };

      const execution$ = agentService.executeAgent(request, mockToolbox);

      // Collect first message to trigger the execution
      await firstValueFrom(execution$);
      
      // Wait a bit for async execution
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockAgent.lastInput?.messages).toHaveLength(2);
      expect(mockAgent.lastInput?.messages[0]).toBe(contextMessage);
      expect(mockAgent.lastInput?.messages[1].content).toBe('Test prompt');
    });
  });
});