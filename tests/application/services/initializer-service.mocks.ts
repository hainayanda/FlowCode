import { ConfigWriter, FlowCodeConfig } from '../../../src/application/interfaces/config-store.js';
import { SettingsWriter, SettingsConfig } from '../../../src/application/interfaces/settings-store.js';
import { CredentialWriter, CredentialsConfig } from '../../../src/application/interfaces/credential-store.js';
import { InitializerStageFactory, InitializerStage, InitializerStageType } from '../../../src/application/interfaces/initializer-stage.js';
import { Result } from '../../../src/application/shared/result.js';
import { BehaviorSubject, Observable } from 'rxjs';
import { DomainMessage, DomainOption } from '../../../src/presentation/view-models/console/console-use-case.js';

export class MockConfigWriter implements ConfigWriter {
  public writeConfigCalled = false;
  public lastConfig: FlowCodeConfig | null = null;
  public ensureConfigDirectoryCalled = false;

  async writeConfig(config: FlowCodeConfig): Promise<void> {
    this.writeConfigCalled = true;
    this.lastConfig = config;
  }

  async updateTaskmasterConfig(): Promise<void> {
    // Mock implementation
  }

  async updateSummarizerConfig(): Promise<void> {
    // Mock implementation
  }

  async updateEmbeddingConfig(): Promise<void> {
    // Mock implementation
  }

  async updateWorkerConfig(): Promise<void> {
    // Mock implementation
  }

  async ensureConfigDirectory(): Promise<void> {
    this.ensureConfigDirectoryCalled = true;
  }
}

export class MockSettingsWriter implements SettingsWriter {
  public writeSettingsCalled = false;
  public lastSettings: SettingsConfig | null = null;
  public ensureSettingsDirectoryCalled = false;

  async writeSettings(settings: SettingsConfig): Promise<boolean> {
    this.writeSettingsCalled = true;
    this.lastSettings = settings;
    return true;
  }

  async ensureSettingsDirectory(): Promise<boolean> {
    this.ensureSettingsDirectoryCalled = true;
    return true;
  }
}

export class MockCredentialWriter implements CredentialWriter {
  public writeCredentialsCalled = false;
  public lastCredentials: CredentialsConfig | null = null;
  public setProviderCredentialCalled = false;
  public ensureCredentialsDirectoryCalled = false;

  async writeCredentials(credentials: CredentialsConfig): Promise<void> {
    this.writeCredentialsCalled = true;
    this.lastCredentials = credentials;
  }

  async setProviderCredential(): Promise<void> {
    this.setProviderCredentialCalled = true;
  }

  async updateLastUsed(): Promise<void> {
    // Mock implementation
  }

  async removeProviderCredential(): Promise<void> {
    // Mock implementation
  }

  async ensureCredentialsDirectory(): Promise<void> {
    this.ensureCredentialsDirectoryCalled = true;
  }
}

export class MockInitializerStage implements InitializerStage {
  readonly stageType: InitializerStageType;
  readonly name: string;
  readonly description: string;

  private messagesSubject = new BehaviorSubject<DomainMessage>({
    id: '1',
    type: 'system',
    content: '',
    timestamp: new Date()
  });

  private optionsSubject = new BehaviorSubject<DomainOption>({
    message: '',
    choices: [],
    defaultIndex: 0
  });

  public startCalled = false;
  public processResponseCalled = false;
  public processOptionSelectionCalled = false;
  public resetCalled = false;
  public lastResponse: string | null = null;
  public lastOptionIndex: number | null = null;

  private completed = false;
  private collectedData: Record<string, unknown> = {};

  constructor(stageType: InitializerStageType, name: string, description: string) {
    this.stageType = stageType;
    this.name = name;
    this.description = description;
  }

  get messages$(): Observable<DomainMessage> {
    return this.messagesSubject.asObservable();
  }

  get options$(): Observable<DomainOption> {
    return this.optionsSubject.asObservable();
  }

  isCompleted(): boolean {
    return this.completed;
  }

  canProceedToNext(): boolean {
    return this.completed;
  }

  start(): Result<void, string> {
    this.startCalled = true;
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `Mock ${this.name} started`,
      timestamp: new Date()
    });
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

  getCollectedData(): Record<string, unknown> {
    return this.collectedData;
  }

  reset(): void {
    this.resetCalled = true;
    this.completed = false;
    this.collectedData = {};
  }

  // Helper methods for testing
  complete(data: Record<string, unknown> = {}): void {
    this.completed = true;
    this.collectedData = data;
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `✓ Mock ${this.name} completed`,
      timestamp: new Date()
    });
  }

  setData(data: Record<string, unknown>): void {
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

  emitOptions(message: string, choices: string[]): void {
    this.optionsSubject.next({
      message,
      choices,
      defaultIndex: 0
    });
  }
}

export class MockInitializerStageFactory implements InitializerStageFactory {
  public createStageCalled = false;
  public lastStageType: InitializerStageType | null = null;
  public createdStages: Map<InitializerStageType, MockInitializerStage> = new Map();

  // Control whether stage creation should fail
  public shouldFail = false;
  public failureMessage = 'Mock failure';

  createStage(stageType: InitializerStageType): Result<InitializerStage, string> {
    this.createStageCalled = true;
    this.lastStageType = stageType;

    if (this.shouldFail) {
      return Result.failure(this.failureMessage);
    }

    // Return existing stage if already created, otherwise create new one
    if (!this.createdStages.has(stageType)) {
      const stageName = this.getStageNameForType(stageType);
      const stage = new MockInitializerStage(stageType, stageName, `Mock ${stageName}`);
      this.createdStages.set(stageType, stage);
    }

    return Result.success(this.createdStages.get(stageType)!);
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

  // Helper methods for testing
  getStageForType(stageType: InitializerStageType): MockInitializerStage | undefined {
    return this.createdStages.get(stageType);
  }

  completeStage(stageType: InitializerStageType, data: Record<string, unknown> = {}): void {
    const stage = this.createdStages.get(stageType);
    if (stage) {
      stage.complete(data);
    }
  }

  private getStageNameForType(stageType: InitializerStageType): string {
    switch (stageType) {
      case InitializerStageType.TaskmasterModel:
        return 'Taskmaster Model Selection';
      case InitializerStageType.Worker:
        return 'Worker Configuration';
      case InitializerStageType.Summarizer:
        return 'Summarizer Configuration';
      case InitializerStageType.Embedding:
        return 'Embedding Configuration';
      case InitializerStageType.DocGeneration:
        return 'Documentation Generation';
      default:
        return 'Unknown Stage';
    }
  }
}