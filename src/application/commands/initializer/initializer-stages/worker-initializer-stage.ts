import { BehaviorSubject, Observable } from 'rxjs';
import { InitializerStage, InitializerStageType, InitializerStageContext } from '../../../interfaces/initializer-stage.js';
import { AgentFactory } from '../../../interfaces/agent.js';
import { CredentialReader } from '../../../interfaces/credential-store.js';
import { Result } from '../../../../shared/result.js';
import { DomainMessage, DomainOption } from '../../../../presentation/view-models/console/console-use-case.js';
import { WorkerConfig } from '../../../interfaces/initializer.js';

export class WorkerInitializerStage implements InitializerStage {
  readonly stageType = InitializerStageType.Worker;
  readonly name = 'Worker Configuration';
  readonly description = 'Configure workers for the multi-agent system';

  private readonly messagesSubject = new BehaviorSubject<DomainMessage>({ 
    id: '1', 
    type: 'system', 
    content: '', 
    timestamp: new Date() 
  });
  private readonly optionsSubject = new BehaviorSubject<DomainOption>({ 
    message: '', 
    choices: [], 
    defaultIndex: 0 
  });

  private completed = false;
  private currentStep: 'add-worker' | 'worker-name' | 'worker-description' | 'worker-model' | 'worker-api-key' | 'ask-more' | 'completed' = 'add-worker';
  private workers: WorkerConfig[] = [];
  private currentWorker: Partial<WorkerConfig> = {};
  private context: InitializerStageContext | null = null;

  get messages$(): Observable<DomainMessage> {
    return this.messagesSubject.asObservable();
  }

  get options$(): Observable<DomainOption> {
    return this.optionsSubject.asObservable();
  }

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly credentialReader: CredentialReader
  ) {}

  isCompleted(): boolean {
    return this.completed;
  }

  canProceedToNext(): boolean {
    // Can proceed when completed, even with no workers (when skipped)
    return this.completed;
  }

  start(context: InitializerStageContext): Result<void, string> {
    this.context = context;
    this.showAddWorkerPrompt();
    return Result.success(undefined);
  }

  processResponse(response: string): Result<void, string> {
    switch (this.currentStep) {
      case 'worker-name':
        return this.handleWorkerName(response.trim());
      case 'worker-description':
        return this.handleWorkerDescription(response.trim());
      case 'worker-api-key':
        return this.handleWorkerApiKey(response.trim());
      default:
        return Result.failure('Text input not supported at this step. Please select an option.');
    }
  }

  processOptionSelection(optionIndex: number): Result<void, string> {
    switch (this.currentStep) {
      case 'add-worker':
        return this.handleAddWorker(optionIndex);
      case 'worker-model':
        return this.handleWorkerModelSelection(optionIndex);
      case 'ask-more':
        return this.handleAskMoreWorkers(optionIndex);
      default:
        return Result.failure('Option selection not supported at this step.');
    }
  }

  getCollectedData(): Record<string, unknown> {
    return {
      workers: this.workers
    };
  }

  reset(): void {
    this.completed = false;
    this.currentStep = 'add-worker';
    this.workers = [];
    this.currentWorker = {};
    this.context = null;
  }

  private showAddWorkerPrompt(): void {
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: 'Do you want to add a worker to your multi-agent system?',
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: 'Add worker?',
      choices: ['Yes, add a worker', 'No, skip worker configuration'],
      defaultIndex: 0
    });
  }

  private handleAddWorker(optionIndex: number): Result<void, string> {
    if (optionIndex === 0) {
      this.askWorkerName();
    } else {
      this.completeStage();
    }
    return Result.success(undefined);
  }

  private askWorkerName(): void {
    this.currentStep = 'worker-name';
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: 'Enter the worker name (e.g., code-worker, api-worker, ui-worker):',
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: '',
      choices: [],
      defaultIndex: 0
    });
  }

  private handleWorkerName(name: string): Result<void, string> {
    if (!name || name.length < 2) {
      return Result.failure('Worker name must be at least 2 characters long.');
    }

    // Check if worker name already exists
    if (this.workers.some(w => w.name === name)) {
      return Result.failure('A worker with this name already exists.');
    }

    this.currentWorker.name = name;
    this.askWorkerDescription();
    return Result.success(undefined);
  }

  private askWorkerDescription(): void {
    this.currentStep = 'worker-description';
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `Enter a description for the ${this.currentWorker.name} worker:`,
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: '',
      choices: [],
      defaultIndex: 0
    });
  }

  private handleWorkerDescription(description: string): Result<void, string> {
    if (!description || description.length < 10) {
      return Result.failure('Worker description must be at least 10 characters long.');
    }

    this.currentWorker.description = description;
    this.showWorkerModelSelection();
    return Result.success(undefined);
  }

  private showWorkerModelSelection(): void {
    this.currentStep = 'worker-model';
    const models = this.agentFactory.getModels();
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `Select a model for the ${this.currentWorker.name} worker:`,
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: 'Available models:',
      choices: models.map(model => `${model.alias} (${model.provider})`),
      defaultIndex: 0
    });
  }

  private handleWorkerModelSelection(optionIndex: number): Result<void, string> {
    const models = this.agentFactory.getModels();
    if (optionIndex < 0 || optionIndex >= models.length) {
      return Result.failure('Invalid model selection.');
    }

    const selectedModel = models[optionIndex];
    this.currentWorker.model = selectedModel.model;
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `Selected: ${selectedModel.alias} (${selectedModel.provider})`,
      timestamp: new Date()
    });

    this.checkWorkerApiKey(selectedModel.provider);
    return Result.success(undefined);
  }

  private async checkWorkerApiKey(provider: string): Promise<void> {
    try {
      const hasCredential = await this.credentialReader.hasCredential(provider);
      
      if (hasCredential) {
        const credential = await this.credentialReader.getProviderCredential(provider);
        if (credential) {
          this.currentWorker.apiKey = credential.apiKey;
          this.saveCurrentWorker();
          return;
        }
      }

      this.requestWorkerApiKey(provider);
    } catch {
      this.requestWorkerApiKey(provider);
    }
  }

  private requestWorkerApiKey(provider: string): void {
    this.currentStep = 'worker-api-key';
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `Please enter your API key for ${provider}:`,
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: '',
      choices: [],
      defaultIndex: 0
    });
  }

  private handleWorkerApiKey(apiKey: string): Result<void, string> {
    if (!apiKey || apiKey.length < 10) {
      return Result.failure('Invalid API key. Please enter a valid API key.');
    }

    this.currentWorker.apiKey = apiKey;
    this.saveCurrentWorker();
    return Result.success(undefined);
  }

  private saveCurrentWorker(): void {
    if (this.currentWorker.name && this.currentWorker.model && this.currentWorker.description) {
      this.workers.push({
        name: this.currentWorker.name,
        model: this.currentWorker.model,
        description: this.currentWorker.description,
        apiKey: this.currentWorker.apiKey
      });

      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: `✓ Worker added: ${this.currentWorker.name}`,
        timestamp: new Date()
      });

      this.currentWorker = {};
      this.askMoreWorkers();
    }
  }

  private askMoreWorkers(): void {
    this.currentStep = 'ask-more';
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `You have ${this.workers.length} worker(s). Do you want to add another worker?`,
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: 'Add another worker?',
      choices: ['Yes, add another worker', 'No, continue'],
      defaultIndex: 1
    });
  }

  private handleAskMoreWorkers(optionIndex: number): Result<void, string> {
    if (optionIndex === 0) {
      this.askWorkerName();
    } else {
      this.completeStage();
    }
    return Result.success(undefined);
  }

  private completeStage(): void {
    this.currentStep = 'completed';
    this.completed = true;

    const message = this.workers.length > 0 
      ? `✓ Worker configuration completed with ${this.workers.length} worker(s)`
      : '✓ Worker configuration skipped';

    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: message,
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: '',
      choices: [],
      defaultIndex: 0
    });
  }
}