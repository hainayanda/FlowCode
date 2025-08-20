import { AgentFactory } from '../../interfaces/agent-factory';
import { AgentWorker, AgentSummarizer } from '../../interfaces/agents';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModel } from '../../models/agent-model';
import { AgentModelConfig } from '../../models/config';
import { AnthropicWorker } from './anthropic-worker';

/**
 * Factory for creating Anthropic Claude agent workers.
 *
 * Provides access to various Claude models from legacy versions to the latest releases,
 * including specialized models for different use cases like reasoning, speed, and complexity.
 */
export class AnthropicFactory implements AgentFactory {
    /**
     * Available Anthropic Claude models.
     *
     * Includes models from Claude 4.1 (latest) down to Claude 3 (legacy),
     * with various specializations for different performance and capability requirements.
     */
    readonly models: AgentModel[] = [
        {
            provider: 'anthropic',
            model: 'claude-opus-4.1',
            alias: 'opus-4.1',
            description:
                'Most capable Claude model for complex reasoning and development (Aug 2025)',
        },
        {
            provider: 'anthropic',
            model: 'claude-sonnet-4',
            alias: 'sonnet-4',
            description:
                'High-performance model with exceptional reasoning and efficiency (May 2025)',
        },
        {
            provider: 'anthropic',
            model: 'claude-2.5-pro',
            alias: 'claude-2.5-pro',
            description:
                'State-of-the-art thinking model for complex problems in code, math, and STEM',
        },
        {
            provider: 'anthropic',
            model: 'claude-2.5-flash',
            alias: 'claude-2.5-flash',
            description:
                'Workhorse thinking model for fast performance on everyday tasks',
        },
        {
            provider: 'anthropic',
            model: 'claude-3.7-sonnet',
            alias: 'sonnet-3.7',
            description:
                'Hybrid AI reasoning model with controllable thinking depth (Feb 2025)',
        },
        {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            alias: 'sonnet-3.5',
            description:
                'Industry-leading model with speed and intelligence balance',
        },
        {
            provider: 'anthropic',
            model: 'claude-3-5-haiku-20241022',
            alias: 'haiku-3.5',
            description:
                'Fast model matching Claude 3 Opus performance on many tasks',
        },
        {
            provider: 'anthropic',
            model: 'claude-3-opus-20240229',
            alias: 'opus-3',
            description: 'Legacy Claude 3 model for complex tasks',
        },
        {
            provider: 'anthropic',
            model: 'claude-3-sonnet-20240229',
            alias: 'sonnet-3',
            description: 'Legacy balanced Claude 3 model',
        },
        {
            provider: 'anthropic',
            model: 'claude-3-haiku-20240307',
            alias: 'haiku-3',
            description: 'Legacy fastest Claude 3 model',
        },
    ];

    /**
     * Creates a new Anthropic agent worker instance.
     *
     * @param name - Unique identifier for the worker instance
     * @param config - Configuration settings for the Anthropic model
     * @param summarizer - Optional summarizer for conversation management (unused in current implementation)
     * @param toolbox - Optional toolbox providing additional capabilities to the agent
     * @returns Configured AnthropicWorker instance ready for use
     */
    createWorker(
        name: string,
        config: AgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker {
        return new AnthropicWorker(name, config, toolbox);
    }
}
