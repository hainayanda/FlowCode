import { BehaviorSubject, Observable } from 'rxjs';
import { InitializerStage, InitializerStageType, InitializerStageContext } from '../../../interfaces/initializer-stage.js';
import { EmbeddingAgentFactory } from '../../../embedded-agents/base-embedding-agent.js';
import { CredentialReader } from '../../../interfaces/credential-store.js';
import { Result } from '../../../shared/result.js';
import { DomainMessage, DomainOption } from '../../../../presentation/view-models/console/console-use-case.js';

export class EmbeddingInitializerStage implements InitializerStage {
  readonly stageType = InitializerStageType.Embedding;
  readonly name = 'Embedding Configuration';
  readonly description = 'Configure vector embeddings for semantic search and context retrieval';

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
  private currentStep: 'use-embedding' | 'model-selection' | 'api-key' | 'completed' = 'use-embedding';
  private useEmbedding = false;
  private selectedModel: string | null = null;
  private selectedProvider: string | null = null;
  private apiKey: string | null = null;

  get messages$(): Observable<DomainMessage> {
    return this.messagesSubject.asObservable();
  }

  get options$(): Observable<DomainOption> {
    return this.optionsSubject.asObservable();
  }

  constructor(
    private readonly embeddingAgentFactory: EmbeddingAgentFactory,
    private readonly credentialReader: CredentialReader
  ) {}

  isCompleted(): boolean {
    return this.completed;
  }

  canProceedToNext(): boolean {
    // Can always proceed to next stage - embeddings are optional
    // If disabled: completed = true, no embedding configured
    // If enabled: completed = true when model and API key are set
    return this.completed || this.currentStep === 'use-embedding';
  }

  start(_context: InitializerStageContext): Result<void, string> {
    this.showEmbeddingPrompt();
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
      case 'use-embedding':
        return this.handleEmbeddingChoice(optionIndex);
      case 'model-selection':
        return this.handleModelSelection(optionIndex);
      default:
        return Result.failure('Option selection not supported at this step.');
    }
  }

  getCollectedData(): Record<string, unknown> {
    if (!this.useEmbedding) {
      return { embedding: null };
    }

    return {
      embedding: {
        provider: this.selectedProvider,
        model: this.selectedModel,
        apiKey: this.apiKey
      }
    };
  }

  reset(): void {
    this.completed = false;
    this.currentStep = 'use-embedding';
    this.useEmbedding = false;
    this.selectedModel = null;
    this.selectedProvider = null;
    this.apiKey = null;
  }

  private showEmbeddingPrompt(): void {
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: 'Do you want to enable vector embeddings for semantic search and context retrieval?\n\nEmbeddings allow FlowCode to:\n- Find relevant past conversations\n- Understand context better\n- Provide more accurate responses',
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: 'Enable embeddings?',
      choices: ['Yes, enable embeddings', 'No, disable embeddings'],
      defaultIndex: 0
    });
  }

  private handleEmbeddingChoice(optionIndex: number): Result<void, string> {
    // Validate option index (should be 0 for "Yes" or 1 for "No")
    if (optionIndex !== 0 && optionIndex !== 1) {
      return Result.failure('Option selection not supported at this step.');
    }

    this.useEmbedding = optionIndex === 0;

    if (this.useEmbedding) {
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: 'Embeddings enabled. Now select a model for generating embeddings.',
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
    const models = this.embeddingAgentFactory.getModels();
    
    if (models.length === 0) {
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: 'No embedding models available. Disabling embeddings.',
        timestamp: new Date()
      });
      this.useEmbedding = false;
      this.completeStage();
      return;
    }

    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: 'Select a model for embeddings (recommended: cost-effective models):',
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: 'Available embedding models:',
      choices: models.map(model => `${model.alias} (${model.provider})`),
      defaultIndex: 0
    });
  }

  private handleModelSelection(optionIndex: number): Result<void, string> {
    const models = this.embeddingAgentFactory.getModels();
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

    const message = this.useEmbedding 
      ? `✓ Embeddings configured: ${this.selectedModel} (${this.selectedProvider})`
      : '✓ Embeddings disabled';

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