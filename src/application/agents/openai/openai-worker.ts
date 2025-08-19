import OpenAI from "openai";
import { AgentModelConfig } from "../../models/config";
import { OpenAICompatibleWorker } from "./openai-compatible-worker";

export class OpenAIWorker extends OpenAICompatibleWorker {

    protected createClient(config: AgentModelConfig): OpenAI {
        return new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        });
    }
}