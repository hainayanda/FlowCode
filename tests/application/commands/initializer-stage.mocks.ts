import { BehaviorSubject, Observable } from 'rxjs';
import { InitializerStage, InitializerStageType, InitializerStageContext } from '../../../src/application/interfaces/initializer-stage.js';
import { Result } from '../../../src/application/shared/result.js';
import { DomainMessage, DomainOption } from '../../../src/presentation/view-models/console/console-use-case.js';

export class InitializerStageMock implements InitializerStage {
  readonly stageType = InitializerStageType.TaskmasterModel;
  readonly name = 'Mock Stage';
  readonly description = 'Mock stage for testing';

  // Tracking properties
  startCalled = false;
  processResponseCalled = false;
  processOptionSelectionCalled = false;
  isCompletedCalled = false;
  canProceedToNextCalled = false;
  getCollectedDataCalled = false;
  resetCalled = false;
  
  lastContext: InitializerStageContext | null = null;
  lastResponse: string | null = null;
  lastOptionIndex: number | null = null;

  private readonly messagesSubject = new BehaviorSubject<DomainMessage>({ 
    id: '1', 
    type: 'system', 
    content: 'Mock stage message', 
    timestamp: new Date() 
  });
  private readonly optionsSubject = new BehaviorSubject<DomainOption>({ 
    message: 'Mock options', 
    choices: ['Option 1', 'Option 2'], 
    defaultIndex: 0 
  });

  // State tracking
  private completed = false;
  private collectedData: Record<string, unknown> = {};

  get messages$(): Observable<DomainMessage> {
    return this.messagesSubject.asObservable();
  }

  get options$(): Observable<DomainOption> {
    return this.optionsSubject.asObservable();
  }

  start(context: InitializerStageContext): Result<void, string> {
    this.startCalled = true;
    this.lastContext = context;
    return Result.success(undefined);
  }

  processResponse(response: string): Result<void, string> {
    this.processResponseCalled = true;
    this.lastResponse = response;
    return Result.success(undefined);
  }

  processOptionSelection(optionIndex: number): Result<void, string> {
    this.processOptionSelectionCalled = true;
    this.lastOptionIndex = optionIndex;
    return Result.success(undefined);
  }

  isCompleted(): boolean {
    this.isCompletedCalled = true;
    return this.completed;
  }

  canProceedToNext(): boolean {
    this.canProceedToNextCalled = true;
    return this.completed;
  }

  getCollectedData(): Record<string, unknown> {
    this.getCollectedDataCalled = true;
    return this.collectedData;
  }

  reset(): void {
    this.resetCalled = true;
    this.completed = false;
    this.lastContext = null;
    this.lastResponse = null;
    this.lastOptionIndex = null;
    this.collectedData = {};
  }

  // Mock control methods
  complete(): void {
    this.completed = true;
  }

  setCollectedData(data: Record<string, unknown>): void {
    this.collectedData = data;
  }

  emitMessage(content: string): void {
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date()
    });
  }

  emitOptions(message: string, choices: string[], defaultIndex = 0): void {
    this.optionsSubject.next({
      message,
      choices,
      defaultIndex
    });
  }
}