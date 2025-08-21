import { AgentModel } from '../models/agent-model';
import { AgentModelConfig } from '../models/config';
import { AgentWorker } from './agent';
import { Toolbox } from './toolbox';

/**
 * Factory interface for creating AI agent workers.
 *
 * Provides a catalog of available models and creates configured worker instances
 * for interaction with AI providers. Factories abstract provider-specific details.
 */
export interface AgentWorkerFactory {
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
