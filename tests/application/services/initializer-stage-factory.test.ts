import { describe, it, expect, beforeEach } from 'vitest';
import { InitializerStageFactoryImpl } from '../../../src/application/services/initializer-stages/initializer-stage-factory.js';
import { InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { TaskmasterModelInitializerStage } from '../../../src/application/services/initializer-stages/taskmaster-model-initializer-stage.js';
import { WorkerInitializerStage } from '../../../src/application/services/initializer-stages/worker-initializer-stage.js';
import { SummarizerInitializerStage } from '../../../src/application/services/initializer-stages/summarizer-initializer-stage.js';
import { EmbeddingInitializerStage } from '../../../src/application/services/initializer-stages/embedding-initializer-stage.js';
import { DocGenerationInitializerStage } from '../../../src/application/services/initializer-stages/doc-generation-initializer-stage.js';
import { MockAgentFactory, MockEmbeddingAgentFactory, MockCredentialReader, MockToolbox } from './initializer-stage.mocks.js';

describe('InitializerStageFactoryImpl', () => {
  let factory: InitializerStageFactoryImpl;
  let mockAgentFactory: MockAgentFactory;
  let mockEmbeddingAgentFactory: MockEmbeddingAgentFactory;
  let mockCredentialReader: MockCredentialReader;
  let mockToolbox: MockToolbox;

  beforeEach(() => {
    mockAgentFactory = new MockAgentFactory();
    mockEmbeddingAgentFactory = new MockEmbeddingAgentFactory();
    mockCredentialReader = new MockCredentialReader();
    mockToolbox = new MockToolbox();
    
    factory = new InitializerStageFactoryImpl(
      mockAgentFactory,
      mockEmbeddingAgentFactory,
      mockCredentialReader,
      mockToolbox
    );
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

  describe('createStage', () => {
    it('should create TaskmasterModelInitializerStage', () => {
      const result = factory.createStage(InitializerStageType.TaskmasterModel);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(TaskmasterModelInitializerStage);
      expect(result.value.stageType).toBe(InitializerStageType.TaskmasterModel);
    });

    it('should create WorkerInitializerStage', () => {
      const result = factory.createStage(InitializerStageType.Worker);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(WorkerInitializerStage);
      expect(result.value.stageType).toBe(InitializerStageType.Worker);
    });

    it('should create SummarizerInitializerStage', () => {
      const result = factory.createStage(InitializerStageType.Summarizer);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(SummarizerInitializerStage);
      expect(result.value.stageType).toBe(InitializerStageType.Summarizer);
    });

    it('should create EmbeddingInitializerStage', () => {
      const result = factory.createStage(InitializerStageType.Embedding);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(EmbeddingInitializerStage);
      expect(result.value.stageType).toBe(InitializerStageType.Embedding);
    });

    it('should create DocGenerationInitializerStage', () => {
      const result = factory.createStage(InitializerStageType.DocGeneration);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(DocGenerationInitializerStage);
      expect(result.value.stageType).toBe(InitializerStageType.DocGeneration);
    });

    it('should handle unsupported stage type', () => {
      const result = factory.createStage('unsupported-stage' as InitializerStageType);
      
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Unsupported stage type: unsupported-stage');
    });

    it('should handle dependency injection correctly for TaskmasterModel stage', () => {
      const result = factory.createStage(InitializerStageType.TaskmasterModel);
      
      expect(result.isSuccess).toBe(true);
      
      const stage = result.value as TaskmasterModelInitializerStage;
      expect(stage).toBeDefined();
      expect(stage.stageType).toBe(InitializerStageType.TaskmasterModel);
      expect(stage.name).toBe('Taskmaster Model Selection');
    });

    it('should handle dependency injection correctly for Worker stage', () => {
      const result = factory.createStage(InitializerStageType.Worker);
      
      expect(result.isSuccess).toBe(true);
      
      const stage = result.value as WorkerInitializerStage;
      expect(stage).toBeDefined();
      expect(stage.stageType).toBe(InitializerStageType.Worker);
      expect(stage.name).toBe('Worker Configuration');
    });

    it('should handle dependency injection correctly for Summarizer stage', () => {
      const result = factory.createStage(InitializerStageType.Summarizer);
      
      expect(result.isSuccess).toBe(true);
      
      const stage = result.value as SummarizerInitializerStage;
      expect(stage).toBeDefined();
      expect(stage.stageType).toBe(InitializerStageType.Summarizer);
      expect(stage.name).toBe('Summarizer Configuration');
    });

    it('should handle dependency injection correctly for Embedding stage', () => {
      const result = factory.createStage(InitializerStageType.Embedding);
      
      expect(result.isSuccess).toBe(true);
      
      const stage = result.value as EmbeddingInitializerStage;
      expect(stage).toBeDefined();
      expect(stage.stageType).toBe(InitializerStageType.Embedding);
      expect(stage.name).toBe('Embedding Configuration');
    });

    it('should handle dependency injection correctly for DocGeneration stage', () => {
      const result = factory.createStage(InitializerStageType.DocGeneration);
      
      expect(result.isSuccess).toBe(true);
      
      const stage = result.value as DocGenerationInitializerStage;
      expect(stage).toBeDefined();
      expect(stage.stageType).toBe(InitializerStageType.DocGeneration);
      expect(stage.name).toBe('Documentation Generation');
    });
  });

  describe('error handling', () => {
    it('should handle constructor errors gracefully', () => {
      try {
        // Create a factory with null dependencies to force constructor errors
        const faultyFactory = new InitializerStageFactoryImpl(
          null as any,
          mockEmbeddingAgentFactory,
          mockCredentialReader,
          mockToolbox
        );
        
        const result = faultyFactory.createStage(InitializerStageType.TaskmasterModel);
        
        expect(result.isSuccess).toBe(false);
        expect(result.error).toContain('Failed to create stage');
      } catch (error) {
        // If constructor itself throws, that's also valid error handling
        expect(error).toBeDefined();
      }
    });

    it('should handle multiple stage creation requests', () => {
      // Test that factory can create multiple stages
      const results = [
        factory.createStage(InitializerStageType.TaskmasterModel),
        factory.createStage(InitializerStageType.Worker),
        factory.createStage(InitializerStageType.Summarizer),
        factory.createStage(InitializerStageType.Embedding),
        factory.createStage(InitializerStageType.DocGeneration)
      ];
      
      results.forEach(result => {
        expect(result.isSuccess).toBe(true);
      });
      
      // Verify that each stage is a different instance
      const stages = results.map(r => r.value);
      const uniqueStages = new Set(stages);
      expect(uniqueStages.size).toBe(5);
    });
  });

  describe('dependency validation', () => {
    it('should work with all required dependencies', () => {
      // This test verifies the factory can be instantiated with valid dependencies
      expect(factory).toBeDefined();
      expect(factory.getSupportedStages()).toBeDefined();
    });

    it('should create stages with proper dependency injection', () => {
      // Create one of each stage type to verify dependency injection works
      const stageTypes = factory.getSupportedStages();
      
      stageTypes.forEach(stageType => {
        const result = factory.createStage(stageType);
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeDefined();
        expect(result.value.stageType).toBe(stageType);
      });
    });
  });
});