import OpenAI from "openai";
import { AgentModelConfig } from "../../models/config";
import { OpenAICompatibleWorker } from "../openai/openai-compatible-worker";
import { Toolbox } from "../../interfaces/toolbox";
import { AgentSummarizer } from "../../interfaces/agents";

export class QwenWorker extends OpenAICompatibleWorker {

    constructor(name: string, config: AgentModelConfig, toolbox?: Toolbox, summarizer?: AgentSummarizer) {
        super(name, config, toolbox, summarizer);
    }

    protected createClient(config: AgentModelConfig): OpenAI {
        return new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1",
        });
    }
}