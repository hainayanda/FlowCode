import { AgentFactory, Agent, AgentConfig, ModelDefinition } from '../../interfaces/agent.js';
import { Toolbox } from '../../interfaces/toolbox.js';
import { MoonshotAgent } from './moonshot-agent.js';

export class MoonshotFactory implements AgentFactory {
  private readonly models: ModelDefinition[] = [
    {
      provider: 'moonshot',
      model: 'moonshot-v1-8k',
      alias: 'moonshot-8k',
      description: 'Moonshot model with 8K context window'
    },
    {
      provider: 'moonshot',
      model: 'moonshot-v1-32k',
      alias: 'moonshot-32k',
      description: 'Moonshot model with 32K context window'
    },
    {
      provider: 'moonshot',
      model: 'moonshot-v1-128k',
      alias: 'moonshot-128k',
      description: 'Moonshot model with 128K context window'
    }
  ];

  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    return new MoonshotAgent(config, toolbox);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'moonshot';
  }

  getProviderName(): string {
    return 'moonshot';
  }

  getModels(): ModelDefinition[] {
    return [...this.models];
  }

  supportsModel(modelName: string): boolean {
    return this.models.some(model => model.model === modelName || model.alias === modelName);
  }

  getModelByAlias(alias: string): ModelDefinition | null {
    return this.models.find(model => model.alias === alias) || null;
  }
}