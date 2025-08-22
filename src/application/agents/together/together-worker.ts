import OpenAI from 'openai';
import { AgentModelConfig } from '../../stores/models/config';
import { Toolbox } from '../../tools/interfaces/toolbox';
import { OpenAICompatibleWorker } from '../openai/openai-compatible-worker';

/**
 * Agent worker implementation for Together AI's model platform.
 * Provides access to various open-source models through Together's infrastructure.
 */
export class TogetherWorker extends OpenAICompatibleWorker {
    /**
     * Creates a new TogetherWorker instance.
     * @param name - The name identifier for this worker
     * @param config - Configuration including API key and optional base URL
     * @param toolbox - Optional toolbox for tool execution capabilities
     */
    constructor(name: string, config: AgentModelConfig, toolbox?: Toolbox) {
        super(name, config, toolbox);
    }

    /**
     * Creates an OpenAI client configured for Together AI's API.
     * Uses Together's OpenAI-compatible endpoint for seamless integration.
     *
     * @param config - Configuration containing API key and optional base URL
     * @returns Configured OpenAI client instance for Together AI API
     */
    protected createClient(config: AgentModelConfig): OpenAI {
        return new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl || 'https://api.together.xyz/v1',
        });
    }
}
