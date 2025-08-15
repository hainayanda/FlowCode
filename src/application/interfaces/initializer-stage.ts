import { Observable } from 'rxjs';
import { Result } from '../shared/result.js';
import { DomainMessage, DomainOption } from '../../presentation/view-models/console/console-use-case.js';

export enum InitializerStageType {
  TaskmasterModel = 'taskmaster-model',
  Worker = 'worker',
  Summarizer = 'summarizer',
  Embedding = 'embedding',
  DocGeneration = 'doc-generation'
}

export interface InitializerStageContext {
  rootDirectory: string;
  flowcodeDirectory: string;
  collectedData: Map<string, unknown>;
}

export interface InitializerStage {
  readonly stageType: InitializerStageType;
  readonly name: string;
  readonly description: string;

  messages$: Observable<DomainMessage>;
  options$: Observable<DomainOption>;
  
  isCompleted(): boolean;
  canProceedToNext(): boolean;
  
  start(context: InitializerStageContext): Result<void, string>;
  processResponse(response: string): Result<void, string>;
  processOptionSelection(optionIndex: number): Result<void, string>;
  
  getCollectedData(): Record<string, unknown>;
  reset(): void;
}

export interface InitializerStageFactory {
  createStage(stageType: InitializerStageType): Result<InitializerStage, string>;
  getSupportedStages(): InitializerStageType[];
}