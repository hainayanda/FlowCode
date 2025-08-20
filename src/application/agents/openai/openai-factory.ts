import { AgentFactory } from '../../interfaces/agent-factory';
import { AgentSummarizer, AgentWorker } from '../../interfaces/agents';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModel } from '../../models/agent-model';
import { AgentModelConfig } from '../../models/config';
import { OpenAIWorker } from './openai-worker';

/**
 * Factory for creating OpenAI agent workers.
 *
 * Provides access to OpenAI's latest models including GPT-5 series with built-in thinking,
 * reasoning models (o3, o4), and legacy GPT-4 variants.
 */
export class OpenAIFactory implements AgentFactory {
    /**
     * Available OpenAI models.
     *
     * Includes GPT-5 series (latest with thinking), reasoning models (o3, o4),
     * and legacy GPT-4o models for backward compatibility.
     */
    readonly models: AgentModel[] = [
        {
            provider: 'openai',
            model: 'gpt-5',
            alias: 'gpt-5',
            description:
                'Latest and smartest OpenAI model with built-in thinking (Aug 2025)',
        },
        {
            provider: 'openai',
            model: 'gpt-5-mini',
            alias: 'gpt-5-mini',
            description: 'Efficient GPT-5 variant for faster responses',
        },
        {
            provider: 'openai',
            model: 'gpt-5-nano',
            alias: 'gpt-5-nano',
            description: 'Lightweight GPT-5 variant for basic tasks',
        },
        {
            provider: 'openai',
            model: 'gpt-5-pro',
            alias: 'gpt-5-pro',
            description:
                'GPT-5 Pro with extended reasoning for Pro subscribers',
        },
        {
            provider: 'openai',
            model: 'gpt-4.5',
            alias: 'gpt-4.5',
            description:
                'Advanced model with better understanding and creativity (deprecated July 2025)',
        },
        {
            provider: 'openai',
            model: 'gpt-4.1',
            alias: 'gpt-4.1',
            description: 'Enhanced GPT-4 with 1M token context window',
        },
        {
            provider: 'openai',
            model: 'gpt-4.1-mini',
            alias: 'gpt-4.1-mini',
            description:
                'Fast, capable, and efficient small model with 1M context',
        },
        {
            provider: 'openai',
            model: 'gpt-4.1-nano',
            alias: 'gpt-4.1-nano',
            description:
                'Fastest and cheapest model with 1M token context window',
        },
        {
            provider: 'openai',
            model: 'o4-mini',
            alias: 'o4-mini',
            description:
                'Latest reasoning model optimized for fast, cost-efficient reasoning',
        },
        {
            provider: 'openai',
            model: 'o3',
            alias: 'o3',
            description:
                'Powerful reasoning model pushing frontier across coding, math, and science',
        },
        {
            provider: 'openai',
            model: 'o3-pro',
            alias: 'o3-pro',
            description:
                'o3 Pro version available for Pro users with enhanced capabilities',
        },
        {
            provider: 'openai',
            model: 'gpt-4o',
            alias: 'gpt-4o',
            description: 'Multimodal GPT-4 model (legacy)',
        },
        {
            provider: 'openai',
            model: 'gpt-4o-mini',
            alias: 'gpt-4o-mini',
            description: 'Faster and affordable GPT-4o variant (legacy)',
        },
    ];

    /**
     * Creates a new OpenAI agent worker instance.
     *
     * @param name - Unique identifier for the worker instance
     * @param config - Configuration settings for the OpenAI model
     * @param toolbox - Optional toolbox providing additional capabilities to the agent
     * @returns Configured OpenAIWorker instance ready for use
     */
    createWorker(
        name: string,
        config: AgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker {
        return new OpenAIWorker(name, config, toolbox);
    }
}
