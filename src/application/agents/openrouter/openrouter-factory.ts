import { AgentFactory } from '../../interfaces/agent-factory';
import { AgentWorker } from '../../interfaces/agent';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModel } from '../../models/agent-model';
import { OpenRouterAgentModelConfig } from '../../models/config';
import { OpenRouterWorker } from './openrouter-worker';

/**
 * Factory for creating OpenRouter agent workers.
 *
 * Provides access to a wide variety of models from different providers through OpenRouter's
 * unified API, including OpenAI, Anthropic, Google, DeepSeek, and other leading AI models.
 */
export class OpenRouterFactory implements AgentFactory {
    /**
     * Available models through OpenRouter gateway.
     *
     * Includes models from OpenAI, Anthropic, Google, DeepSeek, Moonshot, Qwen,
     * Mistral, Cohere, X.AI, and Perplexity through a unified API.
     */
    readonly models: AgentModel[] = [
        // OpenAI Models via OpenRouter
        {
            provider: 'openrouter',
            model: 'openai/gpt-5',
            alias: 'or-gpt-5',
            description: 'GPT-5 via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'openai/gpt-5-mini',
            alias: 'or-gpt-5-mini',
            description: 'GPT-5 Mini via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'openai/o4-mini',
            alias: 'or-o4-mini',
            description: 'o4-mini reasoning model via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'openai/o3',
            alias: 'or-o3',
            description: 'o3 reasoning model via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'openai/gpt-4o',
            alias: 'or-gpt-4o',
            description: 'GPT-4o via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'openai/gpt-4o-mini',
            alias: 'or-gpt-4o-mini',
            description: 'GPT-4o Mini via OpenRouter gateway',
        },

        // Anthropic Models via OpenRouter
        {
            provider: 'openrouter',
            model: 'anthropic/claude-opus-4.1',
            alias: 'or-claude-opus-4.1',
            description: 'Claude Opus 4.1 via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'anthropic/claude-sonnet-4',
            alias: 'or-claude-sonnet-4',
            description: 'Claude Sonnet 4 via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'anthropic/claude-2.5-pro',
            alias: 'or-claude-2.5-pro',
            description: 'Claude 2.5 Pro via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'anthropic/claude-2.5-flash',
            alias: 'or-claude-2.5-flash',
            description: 'Claude 2.5 Flash via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'anthropic/claude-3.5-sonnet',
            alias: 'or-claude-sonnet-3.5',
            description: 'Claude 3.5 Sonnet via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'anthropic/claude-3.5-haiku',
            alias: 'or-claude-haiku-3.5',
            description: 'Claude 3.5 Haiku via OpenRouter gateway',
        },

        // Google Models via OpenRouter
        {
            provider: 'openrouter',
            model: 'google/gemini-2.5-pro',
            alias: 'or-gemini-2.5-pro',
            description: 'Gemini 2.5 Pro via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'google/gemini-2.5-flash',
            alias: 'or-gemini-2.5-flash',
            description: 'Gemini 2.5 Flash via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'google/gemini-2.0-flash-exp',
            alias: 'or-gemini-2.0-flash',
            description: 'Gemini 2.0 Flash via OpenRouter gateway',
        },

        // Meta Models via OpenRouter
        {
            provider: 'openrouter',
            model: 'meta-llama/llama-3.3-70b-instruct',
            alias: 'or-llama-3.3-70b',
            description: 'Llama 3.3 70B via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'meta-llama/llama-3.1-405b-instruct',
            alias: 'or-llama-3.1-405b',
            description: 'Llama 3.1 405B via OpenRouter gateway',
        },

        // Other Popular Models
        {
            provider: 'openrouter',
            model: 'deepseek/deepseek-r1',
            alias: 'or-deepseek-r1',
            description:
                'Latest DeepSeek R1 reasoning model via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'deepseek/deepseek-v3',
            alias: 'or-deepseek-v3',
            description: 'DeepSeek v3 via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'moonshot/kimi-k2',
            alias: 'or-kimi-k2',
            description: 'Moonshot Kimi K2 via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'qwen/qwen-2.5-72b-instruct',
            alias: 'or-qwen-2.5-72b',
            description: 'Qwen 2.5 72B via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'qwen/qwen-3-72b-instruct',
            alias: 'or-qwen-3-72b',
            description: 'Latest Qwen 3 72B via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'mistralai/mixtral-8x7b-instruct',
            alias: 'or-mixtral-8x7b',
            description: 'Mixtral 8x7B via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'cohere/command-r-plus',
            alias: 'or-command-r-plus',
            description: 'Cohere Command R+ via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'cohere/command-a-03-2025',
            alias: 'or-command-a-2025',
            description:
                'Latest Cohere Command A model via OpenRouter gateway (2025)',
        },
        {
            provider: 'openrouter',
            model: 'x-ai/grok-4',
            alias: 'or-grok-4',
            description: 'X.AI Grok-4 via OpenRouter gateway',
        },
        {
            provider: 'openrouter',
            model: 'perplexity/llama-3.1-sonar-large-128k-online',
            alias: 'or-perplexity-sonar',
            description: 'Perplexity Sonar with online search via OpenRouter',
        },
    ];

    /**
     * Creates a new OpenRouter agent worker instance.
     *
     * @param name - Unique identifier for the worker instance
     * @param config - OpenRouter-specific configuration including API settings
     * @param toolbox - Optional toolbox providing additional capabilities to the agent
     * @returns Configured OpenRouterWorker instance ready for use
     */
    createWorker(
        name: string,
        config: OpenRouterAgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker {
        return new OpenRouterWorker(name, config, toolbox);
    }
}
