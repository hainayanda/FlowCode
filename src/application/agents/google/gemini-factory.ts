import { AgentFactory, Agent, AgentConfig, ModelDefinition } from '../../interfaces/agent.js';
import { Toolbox } from '../../interfaces/toolbox.js';
import { GeminiAgent } from './gemini-agent.js';

export class GeminiFactory implements AgentFactory {
  private readonly models: ModelDefinition[] = [
    {
      provider: 'google',
      model: 'gemini-2.5-pro',
      alias: 'gemini-2.5-pro',
      description: 'Most intelligent Gemini model with 2M token context and thinking capabilities (2025)'
    },
    {
      provider: 'google',
      model: 'gemini-2.5-flash',
      alias: 'gemini-2.5-flash',
      description: 'Workhorse thinking model for fast performance on everyday tasks'
    },
    {
      provider: 'google',
      model: 'gemini-2.5-flash-lite',
      alias: 'gemini-2.5-flash-lite',
      description: 'Most cost-efficient and fastest Gemini model (Aug 2025)'
    },
    {
      provider: 'google',
      model: 'gemini-2.0-flash',
      alias: 'gemini-2.0-flash',
      description: 'Next-gen features with superior speed and 1M token context'
    },
    {
      provider: 'google',
      model: 'gemini-2.0-flash-lite',
      alias: 'gemini-2.0-flash-lite',
      description: 'Optimized for cost efficiency and low latency'
    },
    {
      provider: 'google',
      model: 'gemini-2.0-pro-experimental',
      alias: 'gemini-2.0-pro-exp',
      description: 'Best model for coding performance with 2M token context'
    },
    {
      provider: 'google',
      model: 'gemini-1.5-pro',
      alias: 'gemini-1.5-pro',
      description: 'Legacy Gemini Pro model for general tasks'
    },
    {
      provider: 'google',
      model: 'gemini-1.5-flash',
      alias: 'gemini-1.5-flash',
      description: 'Legacy Gemini Flash model for fast responses'
    }
  ];

  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    return new GeminiAgent(config, toolbox);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'google' || provider === 'gemini';
  }

  getProviderName(): string {
    return 'google';
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