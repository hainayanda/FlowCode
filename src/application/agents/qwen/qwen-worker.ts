import OpenAI from "openai";
import { AgentModelConfig } from "../../models/config";
import { OpenAICompatibleWorker } from "../openai/openai-compatible-worker";
import { Toolbox } from "../../interfaces/toolbox";

export class QwenWorker extends OpenAICompatibleWorker {

    constructor(name: string, config: AgentModelConfig, toolbox: Toolbox) {
        super(name, config, toolbox);
    }

    protected createClient(config: AgentModelConfig): OpenAI {
        return new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl || "https://dashscope.aliyuncs.com/compatible-mode/v1",
        });
    }
}