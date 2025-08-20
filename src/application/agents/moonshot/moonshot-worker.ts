import OpenAI from 'openai';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModelConfig } from '../../models/config';
import { OpenAICompatibleWorker } from '../openai/openai-compatible-worker';

/**
 * Agent worker implementation for Moonshot AI's models.
 * Provides access to Moonshot's AI models through their OpenAI-compatible API.
 */
export class MoonshotWorker extends OpenAICompatibleWorker {
    /**
     * Creates a new MoonshotWorker instance.
     * @param name - The name identifier for this worker
     * @param config - Configuration including API key and optional base URL
     * @param toolbox - Optional toolbox for tool execution capabilities
     */
    constructor(name: string, config: AgentModelConfig, toolbox?: Toolbox) {
        super(name, config, toolbox);
    }

    /**
     * Creates an OpenAI client configured for Moonshot AI's API.
     * Uses Moonshot's OpenAI-compatible endpoint for seamless integration.
     *
     * @param config - Configuration containing API key and optional base URL
     * @returns Configured OpenAI client instance for Moonshot AI API
     */
    protected createClient(config: AgentModelConfig): OpenAI {
        return new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl || 'https://api.moonshot.cn/v1',
        });
    }
}
