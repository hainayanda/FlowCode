import { AgentFactory, EmbedderFactory } from '../interfaces/agent-factory';
import { AgentWorker, AgentEmbedder } from '../interfaces/agent';
import { Toolbox } from '../interfaces/toolbox';
import { AgentModel } from '../models/agent-model';
import { AgentModelConfig, EmbeddingConfig } from '../models/config';

/**
 * Central registry for managing multiple agent and embedder factories.
 *
 * Aggregates models from multiple providers and routes worker creation requests
 * to the appropriate factory based on the requested model alias.
 */
export class AgentRegistry implements AgentFactory, EmbedderFactory {
    private underlyingAgentFactories: AgentFactory[];
    private underlyingEmbedderFactory: EmbedderFactory;

    /**
     * Aggregated models from all registered agent factories.
     * Flattens the model catalogs from all providers into a single array.
     */
    get models(): AgentModel[] {
        return this.underlyingAgentFactories.flatMap(
            (factory) => factory.models
        );
    }

    /**
     * Creates a new AgentRegistry with the specified factories.
     *
     * @param agentFactories - Array of agent factories to register
     * @param embedderFactory - Factory for creating embedder instances
     */
    constructor(
        agentFactories: AgentFactory[],
        embedderFactory: EmbedderFactory
    ) {
        this.underlyingAgentFactories = agentFactories;
        this.underlyingEmbedderFactory = embedderFactory;
    }

    /**
     * Creates an agent worker by routing to the appropriate factory.
     *
     * Searches through registered factories to find one that supports
     * the requested model alias, then delegates worker creation.
     *
     * @param name - Unique identifier for the worker instance
     * @param config - Configuration including model alias and settings
     * @param toolbox - Optional toolbox providing additional capabilities
     * @returns Configured agent worker from the appropriate factory
     * @throws Error if no factory supports the requested model
     */
    createWorker(
        name: string,
        config: AgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker {
        const factory = this.underlyingAgentFactories.find((f) =>
            f.models.some((m) => m.alias === config.model)
        );
        if (!factory)
            throw new Error(`No factory found for model ${config.model}`);
        return factory.createWorker(name, config, toolbox);
    }

    /**
     * Creates an embedder instance using the registered embedder factory.
     *
     * @param config - Configuration for the embedding model
     * @returns Configured embedder instance
     */
    createEmbedder(config: EmbeddingConfig): AgentEmbedder {
        return this.underlyingEmbedderFactory.createEmbedder(config);
    }
}
