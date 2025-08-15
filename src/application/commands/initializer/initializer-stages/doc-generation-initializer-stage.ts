import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { InitializerStage, InitializerStageType, InitializerStageContext } from '../../../interfaces/initializer-stage.js';
import { Agent, AgentFactory, AgentConfig } from '../../../interfaces/agent.js';
import { Toolbox } from '../../../interfaces/toolbox.js';
import { Result } from '../../../shared/result.js';
import { DomainMessage, DomainOption } from '../../../../presentation/view-models/console/console-use-case.js';
import { InitializationOptions } from '../../../interfaces/initializer.js';

export class DocGenerationInitializerStage implements InitializerStage {
  readonly stageType = InitializerStageType.DocGeneration;
  readonly name = 'Documentation Generation';
  readonly description = 'Generate markdown files for taskmaster and workers based on project analysis';

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
  private currentStep: 'ask-generation' | 'generating-taskmaster' | 'generating-workers' | 'completed' = 'ask-generation';
  private generateDocs = false;
  private context: InitializerStageContext | null = null;
  private initOptions: InitializationOptions | null = null;
  private toolboxSubscription: Subscription | null = null;

  get messages$(): Observable<DomainMessage> {
    return this.messagesSubject.asObservable();
  }

  get options$(): Observable<DomainOption> {
    return this.optionsSubject.asObservable();
  }

  constructor(
    private readonly agentFactory: AgentFactory,
    private readonly toolbox: Toolbox
  ) {
    // Subscribe to toolbox domain messages and relay them to our message stream
    this.toolboxSubscription = this.toolbox.domainMessages$.subscribe(message => {
      this.messagesSubject.next(message);
    });
  }

  isCompleted(): boolean {
    return this.completed;
  }

  canProceedToNext(): boolean {
    return true; // Can proceed even if skipped
  }

  start(context: InitializerStageContext): Result<void, string> {
    this.context = context;
    this.buildInitializationOptions();
    this.showGenerationPrompt();
    return Result.success(undefined);
  }

  processResponse(_response: string): Result<void, string> {
    return Result.failure('Text input not supported at this step. Please select an option.');
  }

  processOptionSelection(optionIndex: number): Result<void, string> {
    switch (this.currentStep) {
      case 'ask-generation':
        if (optionIndex < 0 || optionIndex > 1) {
          return Result.failure('Invalid option selection. Please choose 0 or 1.');
        }
        return this.handleGenerationChoice(optionIndex);
      default:
        return Result.failure('Option selection not supported at this step.');
    }
  }

  getCollectedData(): Record<string, unknown> {
    return {
      generateMarkdownFiles: this.generateDocs
    };
  }

  reset(): void {
    this.completed = false;
    this.currentStep = 'ask-generation';
    this.generateDocs = false;
    this.context = null;
    this.initOptions = null;
  }

  destroy(): void {
    if (this.toolboxSubscription) {
      this.toolboxSubscription.unsubscribe();
      this.toolboxSubscription = null;
    }
  }

  private buildInitializationOptions(): void {
    if (!this.context) {
      return;
    }

    const collectedData = this.context.collectedData;
    
    this.initOptions = {
      taskmasterModel: (collectedData.get('taskmaster-model-model') as string) || 
                      (collectedData.get('taskmaster-model') as string) || '',
      taskmasterApiKey: (collectedData.get('taskmaster-model-apiKey') as string) || 
                       (collectedData.get('taskmaster-apiKey') as string) || '',
      workers: collectedData.get('workers') as any[] || [],
      summarizer: collectedData.get('summarizer') as any || undefined,
      embedding: collectedData.get('embedding') as any || undefined,
      generateMarkdownFiles: false
    };
  }

  private showGenerationPrompt(): void {
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: 'Do you want to generate markdown documentation files?\n\n• TASKMASTER.md - System prompt for the taskmaster agent\n• [worker-name].md - Prompts for each worker based on project analysis\n\nThe taskmaster will analyze your project structure and generate appropriate documentation.',
      timestamp: new Date()
    });

    this.optionsSubject.next({
      message: 'Generate documentation files?',
      choices: ['Yes, generate documentation', 'No, skip documentation generation'],
      defaultIndex: 0
    });
  }

  private handleGenerationChoice(optionIndex: number): Result<void, string> {
    this.generateDocs = optionIndex === 0;

    if (this.generateDocs) {
      this.startDocumentGeneration();
    } else {
      this.completeStage();
    }

    return Result.success(undefined);
  }

  private async startDocumentGeneration(): Promise<void> {
    if (!this.initOptions || !this.context) {
      this.completeStage();
      return;
    }

    try {
      this.currentStep = 'generating-taskmaster';
      
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: 'Starting documentation generation...\n\n1. Analyzing project structure\n2. Generating TASKMASTER.md\n3. Generating worker documentation files',
        timestamp: new Date()
      });

      // Create taskmaster agent for analysis and generation
      const taskmasterAgent = await this.createTaskmasterAgent();
      if (!taskmasterAgent) {
        this.messagesSubject.next({
          id: Date.now().toString(),
          type: 'system',
          content: '❌ Failed to create taskmaster agent. Skipping documentation generation.',
          timestamp: new Date()
        });
        this.generateDocs = false;
        this.completeStage();
        return;
      }

      // Generate TASKMASTER.md
      await this.generateTaskmasterDoc(taskmasterAgent);
      
      // Generate worker documentation files
      if (this.initOptions.workers.length > 0) {
        await this.generateWorkerDocs(taskmasterAgent);
      }

      this.completeStage();
    } catch (error) {
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: `❌ Error during documentation generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      });
      this.generateDocs = false;
      this.completeStage();
    }
  }

  private async createTaskmasterAgent(): Promise<Agent | null> {
    if (!this.initOptions) {
      return null;
    }

    try {
      const config: AgentConfig = {
        model: this.initOptions.taskmasterModel,
        provider: this.getProviderFromModel(this.initOptions.taskmasterModel),
        apiKey: this.initOptions.taskmasterApiKey || '',
        temperature: 0.1,
        maxTokens: 4000
      };

      return this.agentFactory.createAgent(config, this.toolbox);
    } catch {
      return null;
    }
  }

  private getProviderFromModel(model: string): string {
    const modelDef = this.agentFactory.getModels().find(m => m.model === model);
    return modelDef?.provider || 'openai';
  }

  private async generateTaskmasterDoc(agent: Agent): Promise<void> {
    this.messagesSubject.next({
      id: Date.now().toString(),
      type: 'system',
      content: '🔍 Analyzing project structure...',
      timestamp: new Date()
    });

    const analysisPrompt = `You are a FlowCode taskmaster agent. Analyze this project structure and create a comprehensive TASKMASTER.md file.

Your tasks:
1. Use workspace tools to explore the project structure
2. Identify the project type, architecture, and key technologies
3. Generate a detailed TASKMASTER.md that includes:
   - Project overview and context
   - Your role as taskmaster
   - Available workers and their specializations
   - Task routing guidelines
   - Communication patterns

Focus on creating actionable guidance for intelligent task routing and worker coordination.`;

    try {
      await new Promise<void>((resolve, reject) => {
        agent.processStream({
          messages: [{
            id: Date.now().toString(),
            type: 'user',
            content: analysisPrompt,
            timestamp: new Date()
          }],
          systemPrompt: 'You are a FlowCode taskmaster agent responsible for analyzing projects and generating documentation.',
          temperature: 0.1,
          maxTokens: 4000,
          tools: this.toolbox.getTools()
        }).subscribe({
          next: (response) => {
            // Show the taskmaster's thinking and responses to the user
            if (response.message.type === 'thinking') {
              this.messagesSubject.next({
                id: Date.now().toString(),
                type: 'system',
                content: `🤖 Taskmaster: ${response.message.content}`,
                timestamp: new Date()
              });
            } else if (response.message.type === 'assistant') {
              this.messagesSubject.next({
                id: Date.now().toString(),
                type: 'system',
                content: `📝 Taskmaster: ${response.message.content}`,
                timestamp: new Date()
              });
            }
            
            if (response.finishReason === 'stop') {
              resolve();
            }
          },
          error: (error) => reject(error)
        });
      });

      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: '✓ TASKMASTER.md generated',
        timestamp: new Date()
      });
    } catch {
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: '❌ Failed to generate TASKMASTER.md',
        timestamp: new Date()
      });
    }
  }

  private async generateWorkerDocs(agent: Agent): Promise<void> {
    if (!this.initOptions) {
      return;
    }

    this.currentStep = 'generating-workers';

    for (const worker of this.initOptions.workers) {
      this.messagesSubject.next({
        id: Date.now().toString(),
        type: 'system',
        content: `📝 Generating ${worker.name}.md...`,
        timestamp: new Date()
      });

      const workerPrompt = `Based on your project analysis, generate a specialized prompt file for the "${worker.name}" worker.

Worker Details:
- Name: ${worker.name}
- Description: ${worker.description}
- Model: ${worker.model}

Create a comprehensive ${worker.name}.md file that includes:
1. Worker identity and specialization
2. Specific responsibilities and capabilities
3. Task handling guidelines
4. Tool usage patterns
5. Communication protocols with taskmaster
6. Success criteria and quality standards

Make it specific to this project's context and architecture.`;

      try {
        await new Promise<void>((resolve, reject) => {
          agent.processStream({
            messages: [{
              id: Date.now().toString(),
              type: 'user',
              content: workerPrompt,
              timestamp: new Date()
            }],
            systemPrompt: `You are generating specialized documentation for the ${worker.name} worker in this FlowCode project.`,
            temperature: 0.1,
            maxTokens: 3000,
            tools: this.toolbox.getTools()
          }).subscribe({
            next: (response) => {
              // Show the taskmaster's thinking and responses for each worker
              if (response.message.type === 'thinking') {
                this.messagesSubject.next({
                  id: Date.now().toString(),
                  type: 'system',
                  content: `🤖 Taskmaster (${worker.name}): ${response.message.content}`,
                  timestamp: new Date()
                });
              } else if (response.message.type === 'assistant') {
                this.messagesSubject.next({
                  id: Date.now().toString(),
                  type: 'system',
                  content: `📝 Taskmaster (${worker.name}): ${response.message.content}`,
                  timestamp: new Date()
                });
              }
              
              if (response.finishReason === 'stop') {
                resolve();
              }
            },
            error: (error) => reject(error)
          });
        });

        this.messagesSubject.next({
          id: Date.now().toString(),
          type: 'system',
          content: `✓ ${worker.name}.md generated`,
          timestamp: new Date()
        });
      } catch {
        this.messagesSubject.next({
          id: Date.now().toString(),
          type: 'system',
          content: `❌ Failed to generate ${worker.name}.md`,
          timestamp: new Date()
        });
      }
    }
  }

  private completeStage(): void {
    this.currentStep = 'completed';
    this.completed = true;

    const message = this.generateDocs 
      ? '✓ Documentation generation completed'
      : '✓ Documentation generation skipped';

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