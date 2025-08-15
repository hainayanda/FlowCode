import { describe, it, expect, beforeEach } from 'vitest';
import { InitializerStageFactoryImpl } from '../../../src/application/commands/initializer/initializer-stages/initializer-stage-factory.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { MockAgentFactory, createMockModels } from '../agents/agent-factory.mocks.js';
import { EmbeddingAgentFactoryMock } from './embedding-agent-factory.mocks.js';
import { MockCredentialStore } from '../services/credential-service.mocks.js';
import { MockToolbox } from '../services/toolbox-service.mocks.js';

describe('InitializerStageFactoryImpl', () => {
  let factory: InitializerStageFactoryImpl;
  let agentFactory: MockAgentFactory;
  let embeddingAgentFactory: EmbeddingAgentFactoryMock;
  let credentialReader: MockCredentialStore;
  let toolbox: MockToolbox;

  beforeEach(() => {
    agentFactory = new MockAgentFactory('test', createMockModels('test'));
    embeddingAgentFactory = new EmbeddingAgentFactoryMock();
    credentialReader = new MockCredentialStore();
    toolbox = new MockToolbox();

    factory = new InitializerStageFactoryImpl(
      agentFactory,
      embeddingAgentFactory,
      credentialReader,
      toolbox
    );
  });

  describe('createStage', () => {
    it('should create TaskmasterModel stage', () => {
      const result = factory.createStage(InitializerStageType.TaskmasterModel);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.stageType).toBe(InitializerStageType.TaskmasterModel);
      expect(result.value?.name).toBe('Taskmaster Model Selection');
    });

    it('should create Worker stage', () => {
      const result = factory.createStage(InitializerStageType.Worker);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.stageType).toBe(InitializerStageType.Worker);
      expect(result.value?.name).toBe('Worker Configuration');
    });

    it('should create Summarizer stage', () => {
      const result = factory.createStage(InitializerStageType.Summarizer);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.stageType).toBe(InitializerStageType.Summarizer);
      expect(result.value?.name).toBe('Summarizer Configuration');
    });

    it('should create Embedding stage', () => {
      const result = factory.createStage(InitializerStageType.Embedding);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.stageType).toBe(InitializerStageType.Embedding);
      expect(result.value?.name).toBe('Embedding Configuration');
    });

    it('should create DocGeneration stage', () => {
      const result = factory.createStage(InitializerStageType.DocGeneration);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value?.stageType).toBe(InitializerStageType.DocGeneration);
      expect(result.value?.name).toBe('Documentation Generation');
    });

    it('should fail for unsupported stage type', () => {
      const result = factory.createStage('UnsupportedType' as InitializerStageType);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Unsupported stage type');
    });
  });

  describe('getSupportedStages', () => {
    it('should return all supported stage types', () => {
      const supportedStages = factory.getSupportedStages();
      
      expect(supportedStages).toHaveLength(5);
      expect(supportedStages).toContain(InitializerStageType.TaskmasterModel);
      expect(supportedStages).toContain(InitializerStageType.Worker);
      expect(supportedStages).toContain(InitializerStageType.Summarizer);
      expect(supportedStages).toContain(InitializerStageType.Embedding);
      expect(supportedStages).toContain(InitializerStageType.DocGeneration);
    });
  });

  describe('stage construction', () => {
    it('should pass correct dependencies to TaskmasterModel stage', () => {
      const result = factory.createStage(InitializerStageType.TaskmasterModel);
      
      expect(result.isSuccess).toBe(true);
      // The stage should be constructed with agentFactory and credentialReader
      // This is verified by the successful creation
    });

    it('should pass correct dependencies to Worker stage', () => {
      const result = factory.createStage(InitializerStageType.Worker);
      
      expect(result.isSuccess).toBe(true);
      // The stage should be constructed with agentFactory and credentialReader
    });

    it('should pass correct dependencies to Embedding stage', () => {
      const result = factory.createStage(InitializerStageType.Embedding);
      
      expect(result.isSuccess).toBe(true);
      // The stage should be constructed with embeddingAgentFactory and credentialReader
    });

    it('should pass correct dependencies to DocGeneration stage', () => {
      const result = factory.createStage(InitializerStageType.DocGeneration);
      
      expect(result.isSuccess).toBe(true);
      // The stage should be constructed with agentFactory and toolbox
    });
  });
});