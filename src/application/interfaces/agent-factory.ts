import { AgentModel } from '../models/agent-model';
import { AgentModelConfig, EmbeddingConfig } from '../models/config';
import { AgentEmbedder, AgentSummarizer, AgentWorker } from './agents';
import { Toolbox } from './toolbox';

/**
 * Factory interface for creating AI agent workers.
 *
 * Provides a catalog of available models and creates configured worker instances
 * for interaction with AI providers. Factories abstract provider-specific details.
 */
export interface AgentFactory {
    /**
     * Available AI models from this factory.
     * Each model includes provider, model name, alias, and description.
     */
    models: AgentModel[];

    /**
     * Creates a new agent worker instance.
     *
     * @param name - Unique identifier for the worker instance
     * @param config - Configuration including model, API keys, and options
     * @param toolbox - Optional toolbox providing additional capabilities
     * @returns Configured agent worker ready for use
     */
    createWorker(
        name: string,
        config: AgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker;
}

/**
 * Factory interface for creating embedding models.
 *
 * Handles creation of embedder instances for vector operations and semantic search.
 */
export interface EmbedderFactory {
    /**
     * Creates a new embedder instance.
     *
     * @param config - Configuration for the embedding model
     * @returns Configured embedder ready for vector operations
     */
    createEmbedder(config: EmbeddingConfig): AgentEmbedder;
}
