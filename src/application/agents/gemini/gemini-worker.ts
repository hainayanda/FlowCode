import OpenAI from 'openai';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModelConfig } from '../../models/config';
import { OpenAICompatibleWorker } from '../openai/openai-compatible-worker';

/**
 * Agent worker implementation for Google's Gemini models.
 * Uses Google's OpenAI-compatible API endpoint for seamless integration.
 */
export class GeminiWorker extends OpenAICompatibleWorker {
    /**
     * Creates a new GeminiWorker instance.
     * @param name - The name identifier for this worker
     * @param config - Configuration including API key and optional base URL
     * @param toolbox - Optional toolbox for tool execution capabilities
     */
    constructor(name: string, config: AgentModelConfig, toolbox?: Toolbox) {
        super(name, config, toolbox);
    }

    /**
     * Creates an OpenAI client configured for Google's Gemini API.
     * Uses Google's OpenAI-compatible endpoint for Gemini models.
     *
     * @param config - Configuration containing API key and optional base URL
     * @returns Configured OpenAI client instance for Gemini API
     */
    protected createClient(config: AgentModelConfig): OpenAI {
        return new OpenAI({
            apiKey: config.apiKey,
            baseURL:
                config.baseUrl ||
                'https://generativelanguage.googleapis.com/v1beta/openai/',
        });
    }
}
