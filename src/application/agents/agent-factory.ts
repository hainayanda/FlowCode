import { AgentWorkerFactory } from './interfaces/agent-worker-factory';
import { Embedder, EmbedderFactory } from '../../common/interfaces/embedder';
import { AgentModelConfig, EmbeddingConfig } from '../stores/models/config';
import { Toolbox } from '../tools/interfaces/toolbox';
import { AgentWorker } from './interfaces/agent';
import { AgentModel } from './models/agent-model';

// Import all provider factories
import { AnthropicFactory } from './anthropic/anthropic-factory';
import { AzureFactory } from './azure/azure-factory';
import { GeminiFactory } from './gemini/gemini-factory';
import { NomicFactory } from './local/nomic-factory';
import { MoonshotFactory } from './moonshot/moonshot-factory';
import { OpenAIFactory } from './openai/openai-factory';
import { OpenRouterFactory } from './openrouter/openrouter-factory';
import { QwenFactory } from './qwen/qwen-factory';
import { TogetherFactory } from './together/together-factory';

/**
 * Central agent factory that constructs all provider factories internally.
 *
 * This factory creates fresh agent instances on each request without caching,
 * allowing for different configurations and avoiding state persistence issues.
 * All provider factories are constructed internally, requiring no external dependencies.
 *
 * @example
 * ```typescript
 * const agentFactory = new AgentFactory();
 *
 * // Create a fresh agent each time
 * const agent1 = agentFactory.createWorker('agent1', { model: 'gpt-4' }, toolbox);
 * const agent2 = agentFactory.createWorker('agent2', { model: 'claude-3' }, toolbox);
 *
 * // Create embedder
 * const embedder = agentFactory.createEmbedder({ enabled: true });
 * ```
 */
export class AgentFactory implements AgentWorkerFactory, EmbedderFactory {
    private readonly agentFactories: AgentWorkerFactory[];
    private readonly embedderFactory: EmbedderFactory;

    /**
     * Creates a new AgentFactory with all provider factories constructed internally.
     * No external dependencies required - all factories are instantiated here.
     */
    constructor() {
        // Initialize all agent worker factories
        this.agentFactories = [
            new AnthropicFactory(),
            new OpenAIFactory(),
            new AzureFactory(),
            new GeminiFactory(),
            new MoonshotFactory(),
            new OpenRouterFactory(),
            new QwenFactory(),
            new TogetherFactory(),
        ];

        // Initialize embedder factory
        this.embedderFactory = new NomicFactory();
    }

    /**
     * Aggregated models from all registered agent factories.
     * Flattens the model catalogs from all providers into a single array.
     */
    get models(): AgentModel[] {
        return this.agentFactories.flatMap((factory) => factory.models);
    }

    /**
     * Creates a fresh agent worker instance for each request.
     *
     * Searches through registered factories to find one that supports
     * the requested model alias, then delegates worker creation.
     * Each call creates a new instance - no caching or reuse.
     *
     * @param name - Unique identifier for the worker instance
     * @param config - Configuration including model alias and settings
     * @param toolbox - Optional toolbox providing additional capabilities
     * @returns New agent worker instance from the appropriate factory
     * @throws Error if no factory supports the requested model
     */
    createWorker(
        name: string,
        config: AgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker {
        const factory = this.agentFactories.find((f) =>
            f.models.some((m) => m.alias === config.model)
        );

        if (!factory) {
            throw new Error(`No factory found for model ${config.model}`);
        }

        return factory.createWorker(name, config, toolbox);
    }

    /**
     * Creates a fresh embedder instance for each request.
     *
     * @param config - Configuration for the embedding model
     * @returns New embedder instance
     */
    createEmbedder(config: EmbeddingConfig): Embedder {
        return this.embedderFactory.createEmbedder(config);
    }

    /**
     * Gets all available model aliases for quick reference.
     *
     * @returns Array of all supported model aliases
     */
    getAvailableModels(): string[] {
        return this.models.map((model) => model.alias);
    }

    /**
     * Gets models filtered by provider.
     *
     * @param provider - The provider name to filter by
     * @returns Array of models for the specified provider
     */
    getModelsByProvider(provider: string): AgentModel[] {
        return this.models.filter((model) => model.provider === provider);
    }

    /**
     * Checks if a specific model is supported.
     *
     * @param modelAlias - The model alias to check
     * @returns True if the model is supported, false otherwise
     */
    isModelSupported(modelAlias: string): boolean {
        return this.models.some((model) => model.alias === modelAlias);
    }

    /**
     * Gets all available providers.
     *
     * @returns Array of unique provider names
     */
    getAvailableProviders(): string[] {
        const providers = new Set(this.models.map((model) => model.provider));
        return Array.from(providers);
    }
}
