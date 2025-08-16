import { InitializerStage, InitializerStageFactory, InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { Result } from '../../../src/shared/result.js';

export class InitializerStageFactoryMock implements InitializerStageFactory {
  createStageCalls = 0;
  lastStageType: InitializerStageType | null = null;
  private mockStages: InitializerStage[] = [];
  private currentStageIndex = 0;
  private singleStageMode = false;

  setMockStage(stage: InitializerStage): void {
    this.mockStages = [stage];
    this.currentStageIndex = 0;
  }

  setMockStages(stages: InitializerStage[]): void {
    this.mockStages = stages;
    this.currentStageIndex = 0;
  }

  setSingleStageMode(enabled: boolean): void {
    this.singleStageMode = enabled;
  }

  createStage(stageType: InitializerStageType): Result<InitializerStage, string> {
    this.createStageCalls++;
    this.lastStageType = stageType;

    if (this.mockStages.length === 0) {
      return Result.failure('No mock stages configured');
    }

    if (this.singleStageMode) {
      return Result.success(this.mockStages[0]);
    }

    if (this.currentStageIndex >= this.mockStages.length) {
      return Result.failure('No more mock stages available');
    }

    const stage = this.mockStages[this.currentStageIndex];
    this.currentStageIndex++;
    return Result.success(stage);
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

  reset(): void {
    this.createStageCalls = 0;
    this.lastStageType = null;
    this.currentStageIndex = 0;
  }
}