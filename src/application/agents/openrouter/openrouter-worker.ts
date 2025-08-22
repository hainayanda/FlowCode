import OpenAI from 'openai';
import {
    AgentModelConfig,
    OpenRouterAgentModelConfig,
} from '../../stores/models/config';
import { Toolbox } from '../../tools/interfaces/toolbox';
import { OpenAICompatibleWorker } from '../openai/openai-compatible-worker';

/**
 * Agent worker implementation for OpenRouter's multi-model API.
 * Provides access to various AI models through OpenRouter's unified interface.
 */
export class OpenRouterWorker extends OpenAICompatibleWorker {
    /**
     * Creates a new OpenRouterWorker instance.
     * @param name - The name identifier for this worker
     * @param config - OpenRouter-specific configuration including referer and app name
     * @param toolbox - Optional toolbox for tool execution capabilities
     */
    constructor(
        name: string,
        config: OpenRouterAgentModelConfig,
        toolbox?: Toolbox
    ) {
        super(name, config, toolbox);
    }

    /**
     * Creates an OpenAI client configured for OpenRouter's API.
     * Handles OpenRouter-specific headers for attribution and referrer tracking.
     *
     * @param config - OpenRouter configuration containing API key, referer, and app name
     * @returns Configured OpenAI client instance for OpenRouter API
     */
    protected createClient(config: AgentModelConfig): OpenAI {
        const openRouterConfig = config as OpenRouterAgentModelConfig;
        const headers: Record<string, string> = {};

        if (openRouterConfig.referer) {
            headers['HTTP-Referer'] = openRouterConfig.referer;
        }

        if (openRouterConfig.appName) {
            headers['X-Title'] = openRouterConfig.appName;
        }

        return new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl || 'https://openrouter.ai/api/v1',
            defaultHeaders: headers,
        });
    }
}
