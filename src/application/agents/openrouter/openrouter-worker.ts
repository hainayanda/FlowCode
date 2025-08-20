import OpenAI from "openai";
import { AgentModelConfig, OpenRouterAgentModelConfig } from "../../models/config";
import { OpenAICompatibleWorker } from "../openai/openai-compatible-worker";
import { Toolbox } from "../../interfaces/toolbox";
import { AgentSummarizer } from "../../interfaces/agents";

export class OpenRouterWorker extends OpenAICompatibleWorker {

    constructor(name: string, config: OpenRouterAgentModelConfig, toolbox?: Toolbox, summarizer?: AgentSummarizer) {
        super(name, config, toolbox, summarizer);
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