import OpenAI from 'openai';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModelConfig } from '../../models/config';
import { OpenAICompatibleWorker } from '../openai/openai-compatible-worker';

/**
 * Agent worker implementation for Alibaba's Qwen models.
 * Uses Alibaba Cloud's DashScope platform with OpenAI-compatible interface.
 */
export class QwenWorker extends OpenAICompatibleWorker {
    /**
     * Creates a new QwenWorker instance.
     * @param name - The name identifier for this worker
     * @param config - Configuration including API key and optional base URL
     * @param toolbox - Optional toolbox for tool execution capabilities
     */
    constructor(name: string, config: AgentModelConfig, toolbox?: Toolbox) {
        super(name, config, toolbox);
    }

    /**
     * Creates an OpenAI client configured for Alibaba's Qwen API.
     * Uses DashScope's OpenAI-compatible endpoint for seamless integration.
     *
     * @param config - Configuration containing API key and optional base URL
     * @returns Configured OpenAI client instance for Qwen API
     */
    protected createClient(config: AgentModelConfig): OpenAI {
        return new OpenAI({
            apiKey: config.apiKey,
            baseURL:
                config.baseUrl ||
                'https://dashscope.aliyuncs.com/compatible-mode/v1',
        });
    }
}
