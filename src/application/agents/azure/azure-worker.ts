import OpenAI from 'openai';
import { Toolbox } from '../../interfaces/toolbox';
import { AgentModelConfig, AzureAgentModelConfig } from '../../models/config';
import { OpenAICompatibleWorker } from '../openai/openai-compatible-worker';

/**
 * Agent worker implementation for Azure OpenAI Service.
 * Handles Azure-specific configuration and authentication for OpenAI models.
 */
export class AzureWorker extends OpenAICompatibleWorker {
    /**
     * Creates a new AzureWorker instance.
     * @param name - The name identifier for this worker
     * @param config - Azure-specific configuration including resource name and deployment
     * @param toolbox - Optional toolbox for tool execution capabilities
     */
    constructor(
        name: string,
        config: AzureAgentModelConfig,
        toolbox?: Toolbox
    ) {
        super(name, config, toolbox);
    }

    /**
     * Creates an OpenAI client configured for Azure OpenAI Service.
     * Handles Azure-specific URL formatting and authentication headers.
     *
     * @param config - Azure configuration containing resource name, deployment, and API version
     * @returns Configured OpenAI client instance for Azure OpenAI Service
     */
    protected createClient(config: AgentModelConfig): OpenAI {
        const azureConfig = config as AzureAgentModelConfig;
        return new OpenAI({
            apiKey: azureConfig.apiKey,
            baseURL:
                config.baseUrl ||
                `https://${azureConfig.resourceName}.openai.azure.com/openai/deployments/${azureConfig.deploymentName}`,
            defaultQuery: {
                'api-version': azureConfig.apiVersion || '2024-08-01-preview',
            },
            defaultHeaders: {
                'api-key': azureConfig.apiKey,
            },
        });
    }
}
