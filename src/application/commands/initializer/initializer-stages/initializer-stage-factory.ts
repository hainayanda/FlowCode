import { InitializerStage, InitializerStageFactory, InitializerStageType } from '../../../interfaces/initializer-stage.js';
import { AgentFactory } from '../../../interfaces/agent.js';
import { EmbeddingAgentFactory } from '../../../embedded-agents/base-embedding-agent.js';
import { CredentialReader } from '../../../interfaces/credential-store.js';
import { Toolbox } from '../../../interfaces/toolbox.js';
import { Result } from '../../../shared/result.js';

import { TaskmasterModelInitializerStage } from './taskmaster-model-initializer-stage.js';
import { WorkerInitializerStage } from './worker-initializer-stage.js';
import { SummarizerInitializerStage } from './summarizer-initializer-stage.js';
import { EmbeddingInitializerStage } from './embedding-initializer-stage.js';
import { DocGenerationInitializerStage } from './doc-generation-initializer-stage.js';

export class InitializerStageFactoryImpl implements InitializerStageFactory {
  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly embeddingAgentFactory: EmbeddingAgentFactory,
    private readonly credentialReader: CredentialReader,
    private readonly toolbox: Toolbox
  ) {}

  createStage(stageType: InitializerStageType): Result<InitializerStage, string> {
    try {
      switch (stageType) {
        case InitializerStageType.TaskmasterModel:
          return Result.success(new TaskmasterModelInitializerStage(
            this.agentFactory,
            this.credentialReader
          ));

        case InitializerStageType.Worker:
          return Result.success(new WorkerInitializerStage(
            this.agentFactory,
            this.credentialReader
          ));

        case InitializerStageType.Summarizer:
          return Result.success(new SummarizerInitializerStage(
            this.agentFactory,
            this.credentialReader
          ));

        case InitializerStageType.Embedding:
          return Result.success(new EmbeddingInitializerStage(
            this.embeddingAgentFactory,
            this.credentialReader
          ));

        case InitializerStageType.DocGeneration:
          return Result.success(new DocGenerationInitializerStage(
            this.agentFactory,
            this.toolbox
          ));

        default:
          return Result.failure(`Unsupported stage type: ${stageType}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return Result.failure(`Failed to create stage ${stageType}: ${errorMessage}`);
    }
  }

  getSupportedStages(): InitializerStageType[] {
    return [
      InitializerStageType.TaskmasterModel,
      InitializerStageType.Worker,
      InitializerStageType.Summarizer,
      InitializerStageType.Embedding,
      InitializerStageType.DocGeneration
    ];
  }
}