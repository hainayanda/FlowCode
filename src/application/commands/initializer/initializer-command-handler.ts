import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { InitializationState } from '../../interfaces/initializer.js';
import { InitializerStage, InitializerStageFactory, InitializerStageType, InitializerStageContext } from '../../interfaces/initializer-stage.js';
import { ConfigWriter } from '../../interfaces/config-store.js';
import { SettingsWriter } from '../../interfaces/settings-store.js';
import { CredentialWriter } from '../../interfaces/credential-store.js';
import { Result } from '../../../shared/result.js';
import { DomainMessage, DomainOption, CommandDefinition } from '../../../presentation/view-models/console/console-use-case.js';
import { CommandProvider, CommandResult, InteractiveCommandCapabilities } from '../../interfaces/command-provider.js';
import * as path from 'path';

export class InitializerCommandHandler implements CommandProvider, InteractiveCommandCapabilities {
  // Private properties
  private readonly messagesSubject = new BehaviorSubject<DomainMessage>({ 
    id: '1', 
    type: 'system', 
    content: 'FlowCode Initialization', 
    timestamp: new Date() 
  });
  private readonly optionsSubject = new BehaviorSubject<DomainOption>({ 
    message: 'Welcome to FlowCode initialization', 
    choices: [], 
    defaultIndex: 0 
  });
  private readonly completionSubject = new Subject<{ state: InitializationState; error?: string }>();
  private currentState = InitializationState.NotStarted;
  private currentStageIndex = 0;
  private currentStage: InitializerStage | null = null;
  private context: InitializerStageContext;
  private readonly collectedData = new Map<string, unknown>();
  private readonly stageOrder: InitializerStageType[] = [
    InitializerStageType.TaskmasterModel,
    InitializerStageType.Worker,
    InitializerStageType.Summarizer,
    InitializerStageType.Embedding,
    InitializerStageType.DocGeneration
  ];

  // Public getters
  get messages$(): Observable<DomainMessage> {
    return this.messagesSubject.asObservable();
  }

  get options$(): Observable<DomainOption> {
    return this.optionsSubject.asObservable();
  }

  get interactive(): InteractiveCommandCapabilities {
    return this;
  }

  constructor(
    private readonly rootDirectory: string,
    private readonly stageFactory: InitializerStageFactory,
    private readonly configWriter: ConfigWriter,
    private readonly settingsWriter: SettingsWriter,
    private readonly credentialWriter: CredentialWriter
  ) {
    this.context = {
      rootDirectory: this.rootDirectory,
      flowcodeDirectory: path.join(this.rootDirectory, '.flowcode'),
      collectedData: this.collectedData
    };
  }

  // Public methods - CommandProvider interface
  async execute(command: string, _args: string[]): Promise<CommandResult> {
    if (command !== 'init') {
      return {
        success: false,
        error: 'Initializer service only supports "init" command'
      };
    }

    if (this.isCurrentDirectoryInitialized()) {
      return {
        success: false,
        error: 'FlowCode project is already initialized in this directory.'
      };
    }

    const result = this.start();
    if (!result.isSuccess) {
      return {
        success: false,
        error: `Failed to start initialization: ${result.error}`
      };
    }

    return {
      success: true,
      message: 'FlowCode initialization started. Follow the prompts to configure your project.'
    };
  }

  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'init',
        description: 'Initialize FlowCode project in current directory'
      }
    ];
  }

  supports(command: string): boolean {
    return command === 'init';
  }

  // Public methods - InteractiveCommandCapabilities interface
  processResponse(response: string): Result<void, string> {
    if (!this.currentStage) {
      return Result.failure('No active stage to process response.');
    }

    const result = this.currentStage.processResponse(response);
    if (result.isSuccess && this.currentStage.isCompleted()) {
      this.handleStageCompletion();
    }

    return result;
  }

  processOptionSelection(optionIndex: number): Result<void, string> {
    if (!this.currentStage) {
      return Result.failure('No active stage to process option selection.');
    }

    const result = this.currentStage.processOptionSelection(optionIndex);
    if (result.isSuccess && this.currentStage.isCompleted()) {
      this.handleStageCompletion();
    }

    return result;
  }

  isInteractive(): boolean {
    return this.currentState === InitializationState.InProgress;
  }

  resetInteractiveState(): void {
    this.reset();
  }

  reset(): void {
    this.currentState = InitializationState.NotStarted;
    this.currentStageIndex = 0;
    this.currentStage = null;
    this.collectedData.clear();
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: 'FlowCode initialization reset',
      timestamp: new Date()
    });
  }

  protected isCurrentDirectoryInitialized(): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(this.context.flowcodeDirectory);
    } catch {
      return false;
    }
  }

  // Private methods
  private start(): Result<void, string> {
    if (this.currentState !== InitializationState.NotStarted) {
      return Result.failure('Initialization already in progress or completed.');
    }

    const validationResult = this.validateCurrentDirectory();
    if (!validationResult.isSuccess) {
      return validationResult;
    }

    if (this.isCurrentDirectoryInitialized()) {
      return Result.failure('Directory is already initialized with FlowCode.');
    }

    this.currentState = InitializationState.InProgress;
    this.currentStageIndex = 0;
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: 'Starting FlowCode initialization...',
      timestamp: new Date()
    });

    this.startNextStage();
    return Result.success(undefined);
  }

  private validateCurrentDirectory(): Result<void, string> {
    try {
      if (!this.rootDirectory) {
        return Result.failure('Root directory not specified.');
      }
      return Result.success(undefined);
    } catch {
      return Result.failure('Invalid directory.');
    }
  }

  private startNextStage(): void {
    if (this.currentStageIndex >= this.stageOrder.length) {
      this.completeInitialization();
      return;
    }

    const stageType = this.stageOrder[this.currentStageIndex];
    const stageResult = this.stageFactory.createStage(stageType);
    
    if (!stageResult.isSuccess) {
      this.failInitialization(`Failed to create stage ${stageType}: ${stageResult.error}`);
      return;
    }

    this.currentStage = stageResult.value;
    
    this.currentStage.messages$.subscribe(message => {
      this.messagesSubject.next(message);
    });

    this.currentStage.options$.subscribe(option => {
      this.optionsSubject.next(option);
    });

    const startResult = this.currentStage.start(this.context);
    if (!startResult.isSuccess) {
      this.failInitialization(`Failed to start stage ${stageType}: ${startResult.error}`);
      return;
    }

    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `📋 ${this.currentStage.name} (${this.currentStageIndex + 1}/${this.stageOrder.length})`,
      timestamp: new Date()
    });
  }

  private handleStageCompletion(): void {
    if (!this.currentStage) {
      return;
    }

    const stageData = this.currentStage.getCollectedData();
    const stageKey = this.stageOrder[this.currentStageIndex];
    
    Object.entries(stageData).forEach(([key, value]) => {
      if (key === 'workers' || key === 'summarizer' || key === 'embedding' || key === 'generateMarkdownFiles') {
        this.collectedData.set(key, value);
      } else {
        this.collectedData.set(`${stageKey}-${key}`, value);
      }
    });

    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `✓ ${this.currentStage.name} completed`,
      timestamp: new Date()
    });

    this.currentStageIndex++;
    this.currentStage = null;
    
    setTimeout(() => this.startNextStage(), 500);
  }

  private async completeInitialization(): Promise<void> {
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: '🏁 Finalizing initialization...',
      timestamp: new Date()
    });

    try {
      const structureResult = await this.createProjectStructure();
      if (!structureResult.isSuccess) {
        this.failInitialization(`Failed to create project structure: ${structureResult.error}`);
        return;
      }

      await this.generateConfigurationFiles();
      await this.saveCredentials();

      this.currentState = InitializationState.Completed;
      
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: '🎉 FlowCode initialization completed successfully!\n\nYour project is now ready to use FlowCode multi-agent system.',
        timestamp: new Date()
      });

      this.completionSubject.next({ state: InitializationState.Completed });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.failInitialization(`Initialization failed: ${errorMessage}`);
    }
  }

  private async createProjectStructure(): Promise<Result<void, string>> {
    try {
      await this.settingsWriter.ensureSettingsDirectory();
      
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: '✓ Created .flowcode directory structure',
        timestamp: new Date()
      });

      return Result.success(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return Result.failure(`Failed to create project structure: ${errorMessage}`);
    }
  }

  private async generateConfigurationFiles(): Promise<void> {
    const config = this.buildFlowCodeConfig();
    await this.configWriter.writeConfig(config);

    const settings = this.buildSettingsConfig();
    await this.settingsWriter.writeSettings(settings);

    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: '✓ Configuration files generated',
      timestamp: new Date()
    });
  }

  private async saveCredentials(): Promise<void> {
    const credentials: any = {};
    const savedProviders = new Set<string>();

    const taskmasterProvider = this.collectedData.get('taskmaster-model-provider') as string;
    const taskmasterApiKey = this.collectedData.get('taskmaster-model-apiKey') as string;
    if (taskmasterProvider && taskmasterApiKey && !savedProviders.has(taskmasterProvider)) {
      credentials[taskmasterProvider] = {
        apiKey: taskmasterApiKey,
        lastUsed: new Date().toISOString()
      };
      savedProviders.add(taskmasterProvider);
    }

    const workers = this.collectedData.get('workers') as any[];
    if (workers) {
      for (const worker of workers) {
        if (worker.apiKey && !savedProviders.has(worker.provider)) {
          const provider = this.getProviderFromModel(worker.model);
          credentials[provider] = {
            apiKey: worker.apiKey,
            lastUsed: new Date().toISOString()
          };
          savedProviders.add(provider);
        }
      }
    }

    const summarizer = this.collectedData.get('summarizer') as any;
    if (summarizer?.apiKey && !savedProviders.has(summarizer.provider)) {
      credentials[summarizer.provider] = {
        apiKey: summarizer.apiKey,
        lastUsed: new Date().toISOString()
      };
      savedProviders.add(summarizer.provider);
    }

    const embedding = this.collectedData.get('embedding') as any;
    if (embedding?.apiKey && !savedProviders.has(embedding.provider)) {
      credentials[embedding.provider] = {
        apiKey: embedding.apiKey,
        lastUsed: new Date().toISOString()
      };
      savedProviders.add(embedding.provider);
    }

    if (Object.keys(credentials).length > 0) {
      await this.credentialWriter.writeCredentials(credentials);
      
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: '✓ API credentials saved securely',
        timestamp: new Date()
      });
    }
  }

  private buildFlowCodeConfig(): any {
    const workers = this.collectedData.get('workers') as any[] || [];
    const summarizer = this.collectedData.get('summarizer') as any;
    const embedding = this.collectedData.get('embedding') as any;
    
    const workersConfig: Record<string, any> = {};
    workers.forEach(worker => {
      workersConfig[worker.name] = {
        model: worker.model,
        temperature: 0.7,
        provider: this.getProviderFromModel(worker.model),
        description: worker.description,
        enabled: true
      };
    });

    return {
      version: '1.0.0',
      taskmaster: {
        model: this.collectedData.get('taskmaster-model-model') as string,
        temperature: 0.3,
        provider: this.collectedData.get('taskmaster-model-provider') as string
      },
      summarizer: {
        model: summarizer?.model || 'gpt-4o-mini',
        temperature: 0.1,
        provider: summarizer?.provider || 'openai',
        enabled: !!summarizer
      },
      embedding: {
        provider: embedding?.provider || 'openai',
        model: embedding?.model || 'text-embedding-3-small',
        enabled: !!embedding
      },
      workers: workersConfig
    };
  }

  private buildSettingsConfig(): any {
    return {
      permissions: {
        allow: [
          "file_tools.*",
          "workspace_tools.*",
          "bash_tools.execute_command(command:npm*)",
          "bash_tools.execute_command(command:git*)",
          "web_search_tools.*"
        ],
        deny: [
          "bash_tools.execute_command(command:rm*)",
          "bash_tools.execute_command(command:sudo*)"
        ]
      }
    };
  }

  private getProviderFromModel(model: string): string {
    if (model.includes('gpt')) return 'openai';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('gemini')) return 'google';
    return 'openai';
  }

  private failInitialization(error: string): void {
    this.currentState = InitializationState.Failed;
    
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: `❌ ${error}`,
      timestamp: new Date()
    });

    this.completionSubject.next({ state: InitializationState.Failed, error });
  }
}