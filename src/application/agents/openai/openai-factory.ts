import { AgentFactory, Agent, AgentConfig, ModelDefinition } from '../../interfaces/agent.js';
import { Toolbox } from '../../interfaces/toolbox.js';
import { OpenAIAgent } from './openai-agent.js';

export class OpenAIFactory implements AgentFactory {
  private readonly models: ModelDefinition[] = [
    {
      provider: 'openai',
      model: 'gpt-5',
      alias: 'gpt-5',
      description: 'Latest and smartest OpenAI model with built-in thinking (Aug 2025)'
    },
    {
      provider: 'openai',
      model: 'gpt-5-mini',
      alias: 'gpt-5-mini',
      description: 'Efficient GPT-5 variant for faster responses'
    },
    {
      provider: 'openai',
      model: 'gpt-5-nano',
      alias: 'gpt-5-nano',
      description: 'Lightweight GPT-5 variant for basic tasks'
    },
    {
      provider: 'openai',
      model: 'gpt-4.5',
      alias: 'gpt-4.5',
      description: 'Advanced model with better understanding and creativity'
    },
    {
      provider: 'openai',
      model: 'gpt-4.1',
      alias: 'gpt-4.1',
      description: 'Enhanced GPT-4 with 1M token context window'
    },
    {
      provider: 'openai',
      model: 'gpt-4.1-nano',
      alias: 'gpt-4.1-nano',
      description: 'Compact version of GPT-4.1'
    },
    {
      provider: 'openai',
      model: 'o4-mini',
      alias: 'o4-mini',
      description: 'Latest reasoning model with enhanced capabilities'
    },
    {
      provider: 'openai',
      model: 'o3',
      alias: 'o3',
      description: 'Advanced reasoning model for complex problems'
    },
    {
      provider: 'openai',
      model: 'gpt-4o',
      alias: 'gpt-4o',
      description: 'Multimodal GPT-4 model (legacy)'
    },
    {
      provider: 'openai',
      model: 'gpt-4o-mini',
      alias: 'gpt-4o-mini',
      description: 'Faster and affordable GPT-4o variant (legacy)'
    }
  ];

  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    return new OpenAIAgent(config, toolbox);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'openai';
  }

  getProviderName(): string {
    return 'openai';
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