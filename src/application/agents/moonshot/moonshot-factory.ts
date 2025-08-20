import { AgentFactory } from '../../interfaces/agent-factory';
import { AgentWorker } from '../../interfaces/agent';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModel } from '../../models/agent-model';
import { AgentModelConfig } from '../../models/config';
import { MoonshotWorker } from './moonshot-worker';

/**
 * Factory for creating Moonshot AI agent workers.
 *
 * Provides access to Moonshot's Kimi model family, including the latest K2 series
 * with MoE architecture and specialized models for audio and vision tasks.
 */
export class MoonshotFactory implements AgentFactory {
    /**
     * Available Moonshot AI models.
     *
     * Includes Kimi K2 (latest MoE), K1.5 (reasoning), audio/vision models,
     * and legacy Moonshot models with various context window sizes.
     */
    readonly models: AgentModel[] = [
        {
            provider: 'moonshot',
            model: 'kimi-k2-instruct',
            alias: 'kimi-k2',
            description:
                'Latest Kimi K2 Instruct model, 1T parameter MoE with 128K context (2025)',
        },
        {
            provider: 'moonshot',
            model: 'kimi-k2-base',
            alias: 'kimi-k2-base',
            description:
                'Kimi K2 Base foundation model for fine-tuning and custom solutions',
        },
        {
            provider: 'moonshot',
            model: 'kimi-k1.5',
            alias: 'kimi-k1.5',
            description:
                'Kimi K1.5 model matching OpenAI o1 performance in math and coding (Jan 2025)',
        },
        {
            provider: 'moonshot',
            model: 'kimi-audio',
            alias: 'kimi-audio',
            description:
                'Universal audio foundation model for speech recognition and audio-to-text chat',
        },
        {
            provider: 'moonshot',
            model: 'kimi-dev-72b',
            alias: 'kimi-dev-72b',
            description:
                'Open-source coding LLM achieving 60.4% on SWE-bench Verified',
        },
        {
            provider: 'moonshot',
            model: 'kimi-vl',
            alias: 'kimi-vl',
            description:
                'Vision-Language MoE model for multimodal reasoning and agent capabilities',
        },
        {
            provider: 'moonshot',
            model: 'moonshot-v1-128k',
            alias: 'moonshot-128k',
            description: 'Legacy Moonshot model with 128K context window',
        },
        {
            provider: 'moonshot',
            model: 'moonshot-v1-32k',
            alias: 'moonshot-32k',
            description: 'Legacy Moonshot model with 32K context window',
        },
        {
            provider: 'moonshot',
            model: 'moonshot-v1-8k',
            alias: 'moonshot-8k',
            description: 'Legacy Moonshot model with 8K context window',
        },
    ];

    /**
     * Creates a new Moonshot AI agent worker instance.
     *
     * @param name - Unique identifier for the worker instance
     * @param config - Configuration settings for the Moonshot model
     * @param toolbox - Optional toolbox providing additional capabilities to the agent
     * @returns Configured MoonshotWorker instance ready for use
     */
    createWorker(
        name: string,
        config: AgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker {
        return new MoonshotWorker(name, config, toolbox);
    }
}
