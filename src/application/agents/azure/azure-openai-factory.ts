import { AgentFactory, Agent, AgentConfig, ModelDefinition } from '../../interfaces/agent.js';
import { Toolbox } from '../../interfaces/toolbox.js';
import { AzureOpenAIAgent } from './azure-openai-agent.js';

export class AzureOpenAIFactory implements AgentFactory {
  private readonly models: ModelDefinition[] = [
    {
      provider: 'azure',
      model: 'gpt-5',
      alias: 'azure-gpt-5',
      description: 'GPT-5 via Azure OpenAI with enterprise security'
    },
    {
      provider: 'azure',
      model: 'gpt-5-mini',
      alias: 'azure-gpt-5-mini',
      description: 'GPT-5 Mini via Azure OpenAI'
    },
    {
      provider: 'azure',
      model: 'gpt-4.5',
      alias: 'azure-gpt-4.5',
      description: 'GPT-4.5 via Azure OpenAI'
    },
    {
      provider: 'azure',
      model: 'gpt-4.1',
      alias: 'azure-gpt-4.1',
      description: 'GPT-4.1 via Azure OpenAI with 1M context'
    },
    {
      provider: 'azure',
      model: 'o4-mini',
      alias: 'azure-o4-mini',
      description: 'o4-mini reasoning model via Azure OpenAI'
    },
    {
      provider: 'azure',
      model: 'o3',
      alias: 'azure-o3',
      description: 'o3 reasoning model via Azure OpenAI'
    },
    {
      provider: 'azure',
      model: 'gpt-4o',
      alias: 'azure-gpt-4o',
      description: 'GPT-4o via Azure OpenAI (legacy)'
    },
    {
      provider: 'azure',
      model: 'gpt-4o-mini',
      alias: 'azure-gpt-4o-mini',
      description: 'GPT-4o Mini via Azure OpenAI (legacy)'
    },
    {
      provider: 'azure',
      model: 'gpt-4-turbo',
      alias: 'azure-gpt-4-turbo',
      description: 'GPT-4 Turbo via Azure OpenAI (legacy)'
    },
    {
      provider: 'azure',
      model: 'gpt-35-turbo',
      alias: 'azure-gpt-3.5',
      description: 'GPT-3.5 Turbo via Azure OpenAI (legacy)'
    }
  ];

  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    return new AzureOpenAIAgent(config, toolbox);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'azure' || provider === 'azure-openai';
  }

  getProviderName(): string {
    return 'azure';
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