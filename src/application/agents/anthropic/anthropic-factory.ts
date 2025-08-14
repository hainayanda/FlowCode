import { AgentFactory, Agent, AgentConfig, ModelDefinition } from '../../interfaces/agent.js';
import { Toolbox } from '../../interfaces/toolbox.js';
import { AnthropicAgent } from './anthropic-agent.js';

export class AnthropicFactory implements AgentFactory {
  private readonly models: ModelDefinition[] = [
    {
      provider: 'anthropic',
      model: 'claude-opus-4.1',
      alias: 'opus-4.1',
      description: 'Most capable Claude model for complex reasoning and development (Aug 2025)'
    },
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      alias: 'sonnet-4',
      description: 'High-performance model with exceptional reasoning and efficiency (May 2025)'
    },
    {
      provider: 'anthropic',
      model: 'claude-3.7-sonnet',
      alias: 'sonnet-3.7',
      description: 'Hybrid AI reasoning model with controllable thinking depth (Feb 2025)'
    },
    {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      alias: 'sonnet-3.5',
      description: 'Industry-leading model with speed and intelligence balance'
    },
    {
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      alias: 'haiku-3.5',
      description: 'Fast model matching Claude 3 Opus performance on many tasks'
    },
    {
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      alias: 'opus-3',
      description: 'Legacy Claude 3 model for complex tasks'
    },
    {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      alias: 'sonnet-3',
      description: 'Legacy balanced Claude 3 model'
    },
    {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      alias: 'haiku-3',
      description: 'Legacy fastest Claude 3 model'
    }
  ];

  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    return new AnthropicAgent(config, toolbox);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'anthropic';
  }

  getProviderName(): string {
    return 'anthropic';
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