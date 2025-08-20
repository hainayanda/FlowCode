import OpenAI from "openai";
import { AgentModelConfig, OpenRouterAgentModelConfig } from "../../models/config";
import { OpenAICompatibleWorker } from "../openai/openai-compatible-worker";
import { Toolbox } from "../../interfaces/toolbox";

export class OpenRouterWorker extends OpenAICompatibleWorker {

    constructor(name: string, config: OpenRouterAgentModelConfig, toolbox?: Toolbox) {
        super(name, config, toolbox);
    }

    protected createClient(config: AgentModelConfig): OpenAI {
        const openRouterConfig = config as OpenRouterAgentModelConfig;
        const headers: Record<string, string> = {};
        
        if (openRouterConfig.referer) {
            headers['HTTP-Referer'] = openRouterConfig.referer;
        }
        
        if (openRouterConfig.appName) {
            headers['X-Title'] = openRouterConfig.appName;
        }

        return new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl || "https://openrouter.ai/api/v1",
            defaultHeaders: headers,
        });
    }
}