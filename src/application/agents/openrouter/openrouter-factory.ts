import { AgentFactory, Agent, AgentConfig, ModelDefinition } from '../../interfaces/agent.js';
import { Toolbox } from '../../interfaces/toolbox.js';
import { OpenRouterAgent } from './openrouter-agent.js';

export class OpenRouterFactory implements AgentFactory {
  private readonly models: ModelDefinition[] = [
    // OpenAI Models via OpenRouter
    {
      provider: 'openrouter',
      model: 'openai/gpt-5',
      alias: 'or-gpt-5',
      description: 'GPT-5 via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'openai/gpt-4o',
      alias: 'or-gpt-4o',
      description: 'GPT-4o via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      alias: 'or-gpt-4o-mini',
      description: 'GPT-4o Mini via OpenRouter gateway'
    },
    
    // Anthropic Models via OpenRouter
    {
      provider: 'openrouter',
      model: 'anthropic/claude-opus-4.1',
      alias: 'or-claude-opus-4.1',
      description: 'Claude Opus 4.1 via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-sonnet',
      alias: 'or-claude-sonnet-3.5',
      description: 'Claude 3.5 Sonnet via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'anthropic/claude-3.5-haiku',
      alias: 'or-claude-haiku-3.5',
      description: 'Claude 3.5 Haiku via OpenRouter gateway'
    },
    
    // Google Models via OpenRouter
    {
      provider: 'openrouter',
      model: 'google/gemini-2.5-pro-experimental',
      alias: 'or-gemini-2.5-pro',
      description: 'Gemini 2.5 Pro via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'google/gemini-2.0-flash-exp',
      alias: 'or-gemini-2.0-flash',
      description: 'Gemini 2.0 Flash via OpenRouter gateway'
    },
    
    // Meta Models via OpenRouter
    {
      provider: 'openrouter',
      model: 'meta-llama/llama-3.3-70b-instruct',
      alias: 'or-llama-3.3-70b',
      description: 'Llama 3.3 70B via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'meta-llama/llama-3.1-405b-instruct',
      alias: 'or-llama-3.1-405b',
      description: 'Llama 3.1 405B via OpenRouter gateway'
    },
    
    // Other Popular Models
    {
      provider: 'openrouter',
      model: 'deepseek/deepseek-v3',
      alias: 'or-deepseek-v3',
      description: 'DeepSeek v3 via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'qwen/qwen-2.5-72b-instruct',
      alias: 'or-qwen-2.5-72b',
      description: 'Qwen 2.5 72B via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'mistralai/mixtral-8x7b-instruct',
      alias: 'or-mixtral-8x7b',
      description: 'Mixtral 8x7B via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'cohere/command-r-plus',
      alias: 'or-command-r-plus',
      description: 'Cohere Command R+ via OpenRouter gateway'
    },
    {
      provider: 'openrouter',
      model: 'perplexity/llama-3.1-sonar-large-128k-online',
      alias: 'or-perplexity-sonar',
      description: 'Perplexity Sonar with online search via OpenRouter'
    }
  ];

  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    return new OpenRouterAgent(config, toolbox);
  }

  supportsProvider(provider: string): boolean {
    return provider === 'openrouter';
  }

  getProviderName(): string {
    return 'openrouter';
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