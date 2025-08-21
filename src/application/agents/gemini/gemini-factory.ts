import { AgentWorker } from '../../interfaces/agent';
import { AgentWorkerFactory } from '../../interfaces/agent-worker-factory';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModel } from '../../models/agent-model';
import { AgentModelConfig } from '../../models/config';
import { GeminiWorker } from './gemini-worker';

/**
 * Factory for creating Google Gemini agent workers.
 *
 * Provides access to Google's Gemini model family, including the latest 2.5 series
 * with thinking capabilities and the 2.0 series with experimental features.
 */
export class GeminiFactory implements AgentWorkerFactory {
    /**
     * Available Google Gemini models.
     *
     * Includes Gemini 2.5 (latest with thinking), Gemini 2.0 (experimental features),
     * and legacy Gemini 1.5 models with varying performance characteristics.
     */
    readonly models: AgentModel[] = [
        {
            provider: 'google',
            model: 'gemini-2.5-pro',
            alias: 'gemini-2.5-pro',
            description:
                'Most intelligent Gemini model with 2M token context and thinking capabilities (2025)',
        },
        {
            provider: 'google',
            model: 'gemini-2.5-flash',
            alias: 'gemini-2.5-flash',
            description:
                'Workhorse thinking model for fast performance on everyday tasks',
        },
        {
            provider: 'google',
            model: 'gemini-2.5-flash-lite',
            alias: 'gemini-2.5-flash-lite',
            description:
                'Most cost-efficient and fastest Gemini model (Aug 2025)',
        },
        {
            provider: 'google',
            model: 'gemini-2.0-flash',
            alias: 'gemini-2.0-flash',
            description:
                'Next-gen features with superior speed and 1M token context',
        },
        {
            provider: 'google',
            model: 'gemini-2.0-flash-lite',
            alias: 'gemini-2.0-flash-lite',
            description: 'Optimized for cost efficiency and low latency',
        },
        {
            provider: 'google',
            model: 'gemini-2.0-pro-experimental',
            alias: 'gemini-2.0-pro-exp',
            description:
                'Best model for coding performance with 2M token context',
        },
        {
            provider: 'google',
            model: 'gemini-2.0-flash-thinking-experimental',
            alias: 'gemini-2.0-flash-thinking',
            description:
                'Gemini 2.0 Flash with experimental thinking capabilities',
        },
        {
            provider: 'google',
            model: 'gemini-1.5-pro',
            alias: 'gemini-1.5-pro',
            description: 'Legacy Gemini Pro model for general tasks',
        },
        {
            provider: 'google',
            model: 'gemini-1.5-flash',
            alias: 'gemini-1.5-flash',
            description: 'Legacy Gemini Flash model for fast responses',
        },
    ];

    /**
     * Creates a new Google Gemini agent worker instance.
     *
     * @param name - Unique identifier for the worker instance
     * @param config - Configuration settings for the Gemini model
     * @param toolbox - Optional toolbox providing additional capabilities to the agent
     * @returns Configured GeminiWorker instance ready for use
     */
    createWorker(
        name: string,
        config: AgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker {
        return new GeminiWorker(name, config, toolbox);
    }
}
