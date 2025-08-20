import OpenAI from 'openai';
import { AgentModelConfig } from '../../models/config';
import { OpenAICompatibleWorker } from './openai-compatible-worker';

/**
 * Agent worker implementation for OpenAI's GPT models.
 * Handles direct integration with OpenAI's official API.
 */
export class OpenAIWorker extends OpenAICompatibleWorker {
    /**
     * Creates an OpenAI client configured for the official OpenAI API.
     * @param config - Configuration containing API key and optional base URL
     * @returns Configured OpenAI client instance
     */
    protected createClient(config: AgentModelConfig): OpenAI {
        return new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        });
    }
}
