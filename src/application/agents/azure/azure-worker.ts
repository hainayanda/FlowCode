import OpenAI from "openai";
import { AgentModelConfig, AzureAgentModelConfig } from "../../models/config";
import { OpenAICompatibleWorker } from "../openai/openai-compatible-worker";
import { Toolbox } from "../../interfaces/toolbox";

export class AzureWorker extends OpenAICompatibleWorker {

    constructor(name: string, config: AzureAgentModelConfig, toolbox: Toolbox) {
        super(name, config, toolbox);
    }

    protected createClient(config: AgentModelConfig): OpenAI {
        const azureConfig = config as AzureAgentModelConfig;
        return new OpenAI({
            apiKey: azureConfig.apiKey,
            baseURL: config.baseUrl || `https://${azureConfig.resourceName}.openai.azure.com/openai/deployments/${azureConfig.deploymentName}`,
            defaultQuery: { 'api-version': azureConfig.apiVersion || '2024-08-01-preview' },
            defaultHeaders: {
                'api-key': azureConfig.apiKey,
            }
        });
    }
}