import { BehaviorSubject, Observable } from 'rxjs';
import { InitializerStage, InitializerStageType, InitializerStageContext } from '../../../interfaces/initializer-stage.js';
import { AgentFactory } from '../../../interfaces/agent.js';
import { CredentialReader } from '../../../interfaces/credential-store.js';
import { Result } from '../../../../shared/result.js';
import { DomainMessage, DomainOption } from '../../../../presentation/view-models/console/console-use-case.js';

export class SummarizerInitializerStage implements InitializerStage {
  readonly stageType = InitializerStageType.Summarizer;
  readonly name = 'Summarizer Configuration';
  readonly description = 'Configure summarizer for conversation context management';

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
  private currentStep: 'use-summarizer' | 'model-selection' | 'api-key' | 'completed' = 'use-summarizer';
  private useSummarizer = false;
  private selectedModel: string | null = null;
  private selectedProvider: string | null = null;
  private apiKey: string | null = null;
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
    // Can always proceed to next stage - summarizer is optional
    return this.completed || this.currentStep === 'use-summarizer';
  }

  start(context: InitializerStageContext): Result<void, string> {
    this.context = context;
    this.showSummarizerPrompt();
    return Result.success(undefined);
  }

  processResponse(response: string): Result<void, string> {
    switch (this.currentStep) {
      case 'api-key':
        return this.handleApiKeyInput(response.trim());
      default:
        return Result.failure('Text input not supported at this step. Please select an option.');
    }
  }

  processOptionSelection(optionIndex: number): Result<void, string> {
    switch (this.currentStep) {
      case 'use-summarizer':
        return this.handleSummarizerChoice(optionIndex);
      case 'model-selection':
        return this.handleModelSelection(optionIndex);
      default:
        return Result.failure('Option selection not supported at this step.');
    }
  }

  getCollectedData(): Record<string, unknown> {
    if (!this.useSummarizer) {
      return { summarizer: null };
    }

    return {
      summarizer: {
        provider: this.selectedProvider,
        model: this.selectedModel,
        apiKey: this.apiKey
      }
    };
  }

  reset(): void {
    this.completed = false;
    this.currentStep = 'use-summarizer';
    this.useSummarizer = false;
    this.selectedModel = null;
    this.selectedProvider = null;
    this.apiKey = null;
    this.context = null;
  }

  private showSummarizerPrompt(): void {
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: 'Do you want to enable conversation summarizer for context management?\n\nThe summarizer helps maintain conversation context by creating summaries of past interactions when the context window gets large.',
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: 'Enable summarizer?',
      choices: ['Yes, enable summarizer', 'No, disable summarizer'],
      defaultIndex: 0
    });
  }

  private handleSummarizerChoice(optionIndex: number): Result<void, string> {
    // Validate option index (should be 0 for "Yes" or 1 for "No")
    if (optionIndex !== 0 && optionIndex !== 1) {
      return Result.failure('Invalid model selection.');
    }

    this.useSummarizer = optionIndex === 0;

    if (this.useSummarizer) {
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: 'Summarizer enabled. Now select a model for the summarizer.',
        timestamp: new Date()
      });
      this.showModelSelection();
    } else {
      this.completeStage();
    }

    return Result.success(undefined);
  }

  private showModelSelection(): void {
    this.currentStep = 'model-selection';
    const models = this.agentFactory.getModels();
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: 'Select a model for the summarizer (recommended: cost-effective models):',
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: 'Available models:',
      choices: models.map(model => `${model.alias} (${model.provider})`),
      defaultIndex: 0
    });
  }

  private handleModelSelection(optionIndex: number): Result<void, string> {
    const models = this.agentFactory.getModels();
    if (optionIndex < 0 || optionIndex >= models.length) {
      return Result.failure('Invalid model selection.');
    }

    const selectedModel = models[optionIndex];
    this.selectedModel = selectedModel.model;
    this.selectedProvider = selectedModel.provider;

    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `Selected: ${selectedModel.alias} (${selectedModel.provider})`,
      timestamp: new Date()
    });

    this.checkApiKey();
    return Result.success(undefined);
  }

  private async checkApiKey(): Promise<void> {
    if (!this.selectedProvider) {
      return;
    }

    try {
      const hasCredential = await this.credentialReader.hasCredential(this.selectedProvider);
      
      if (hasCredential) {
        const credential = await this.credentialReader.getProviderCredential(this.selectedProvider);
        if (credential) {
          this.apiKey = credential.apiKey;
          this.completeStage();
          return;
        }
      }

      this.requestApiKey();
    } catch {
      this.requestApiKey();
    }
  }

  private requestApiKey(): void {
    this.currentStep = 'api-key';
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `Please enter your API key for ${this.selectedProvider}:`,
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: '',
      choices: [],
      defaultIndex: 0
    });
  }

  private handleApiKeyInput(apiKey: string): Result<void, string> {
    if (!apiKey || apiKey.length < 10) {
      return Result.failure('Invalid API key. Please enter a valid API key.');
    }

    this.apiKey = apiKey;
    this.completeStage();
    return Result.success(undefined);
  }

  private completeStage(): void {
    this.currentStep = 'completed';
    this.completed = true;

    const message = this.useSummarizer 
      ? `✓ Summarizer configured: ${this.selectedModel} (${this.selectedProvider})`
      : '✓ Summarizer disabled';

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