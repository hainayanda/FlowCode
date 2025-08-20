import { AgentFactory } from '../../interfaces/agent-factory';
import { AgentWorker, AgentSummarizer } from '../../interfaces/agents';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModel } from '../../models/agent-model';
import { AzureAgentModelConfig } from '../../models/config';
import { AzureWorker } from './azure-worker';

/**
 * Factory for creating Azure OpenAI agent workers.
 *
 * Provides access to OpenAI models through Azure's enterprise-grade infrastructure,
 * including the latest GPT-5 series and reasoning models with enhanced security and compliance.
 */
export class AzureFactory implements AgentFactory {
    /**
     * Available Azure OpenAI models.
     *
     * Includes latest GPT-5 models, reasoning models (o3, o4), and legacy GPT-4 variants,
     * all accessed through Azure's secure enterprise infrastructure.
     */
    readonly models: AgentModel[] = [
        {
            provider: 'azure',
            model: 'gpt-5',
            alias: 'azure-gpt-5',
            description: 'GPT-5 via Azure OpenAI with enterprise security',
        },
        {
            provider: 'azure',
            model: 'gpt-5-mini',
            alias: 'azure-gpt-5-mini',
            description: 'GPT-5 Mini via Azure OpenAI',
        },
        {
            provider: 'azure',
            model: 'gpt-5-nano',
            alias: 'azure-gpt-5-nano',
            description: 'GPT-5 Nano via Azure OpenAI',
        },
        {
            provider: 'azure',
            model: 'gpt-4.5',
            alias: 'azure-gpt-4.5',
            description: 'GPT-4.5 via Azure OpenAI (deprecated July 2025)',
        },
        {
            provider: 'azure',
            model: 'gpt-4.1',
            alias: 'azure-gpt-4.1',
            description: 'GPT-4.1 via Azure OpenAI with 1M context',
        },
        {
            provider: 'azure',
            model: 'gpt-4.1-nano',
            alias: 'azure-gpt-4.1-nano',
            description: 'GPT-4.1 Nano via Azure OpenAI with 1M context',
        },
        {
            provider: 'azure',
            model: 'o4-mini',
            alias: 'azure-o4-mini',
            description:
                'o4-mini reasoning model via Azure OpenAI with 200K context',
        },
        {
            provider: 'azure',
            model: 'o3',
            alias: 'azure-o3',
            description:
                'o3 reasoning model via Azure OpenAI with 200K context',
        },
        {
            provider: 'azure',
            model: 'o3-mini',
            alias: 'azure-o3-mini',
            description:
                'o3-mini reasoning model via Azure OpenAI with 200K context',
        },
        {
            provider: 'azure',
            model: 'gpt-4o',
            alias: 'azure-gpt-4o',
            description: 'GPT-4o via Azure OpenAI (legacy)',
        },
        {
            provider: 'azure',
            model: 'gpt-4o-mini',
            alias: 'azure-gpt-4o-mini',
            description: 'GPT-4o Mini via Azure OpenAI (legacy)',
        },
        {
            provider: 'azure',
            model: 'gpt-4-turbo',
            alias: 'azure-gpt-4-turbo',
            description: 'GPT-4 Turbo via Azure OpenAI (legacy)',
        },
        {
            provider: 'azure',
            model: 'gpt-35-turbo',
            alias: 'azure-gpt-3.5',
            description: 'GPT-3.5 Turbo via Azure OpenAI (legacy)',
        },
    ];

    /**
     * Creates a new Azure OpenAI agent worker instance.
     *
     * @param name - Unique identifier for the worker instance
     * @param config - Azure-specific configuration including deployment details
     * @param toolbox - Optional toolbox providing additional capabilities to the agent
     * @returns Configured AzureWorker instance ready for use
     */
    createWorker(
        name: string,
        config: AzureAgentModelConfig,
        toolbox?: Toolbox
    ): AgentWorker {
        return new AzureWorker(name, config, toolbox);
    }
}
