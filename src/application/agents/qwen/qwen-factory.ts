import { AgentFactory } from "../../interfaces/agent-factory";
import { AgentSummarizer, AgentWorker } from "../../interfaces/agents";
import { Toolbox } from "../../interfaces/toolbox";
import { AgentModel } from "../../models/agent-model";
import { AgentModelConfig } from "../../models/config";
import { QwenWorker } from "./qwen-worker";

export class QwenFactory implements AgentFactory {
    readonly models: AgentModel[] = [
        {
            provider: 'qwen',
            model: 'qwen-max-2025-01-25',
            alias: 'qwen-max',
            description: 'Latest Qwen2.5-Max MoE model with 20T+ training tokens and RLHF (2025)'
        },
        {
            provider: 'qwen',
            model: 'qwen2.5-turbo',
            alias: 'qwen-2.5-turbo',
            description: 'Qwen2.5 Turbo model for fast and efficient processing'
        },
        {
            provider: 'qwen',
            model: 'qwen2.5-plus',
            alias: 'qwen-2.5-plus',
            description: 'Enhanced Qwen2.5 model with improved capabilities'
        },
        {
            provider: 'qwen',
            model: 'qwen2.5-72b-instruct',
            alias: 'qwen-2.5-72b',
            description: 'Qwen2.5 72B parameter model for complex reasoning tasks'
        },
        {
            provider: 'qwen',
            model: 'qwen2.5-32b-instruct',
            alias: 'qwen-2.5-32b',
            description: 'Qwen2.5 32B parameter model for balanced performance'
        },
        {
            provider: 'qwen',
            model: 'qwen2.5-14b-instruct',
            alias: 'qwen-2.5-14b',
            description: 'Qwen2.5 14B parameter model for efficient processing'
        },
        {
            provider: 'qwen',
            model: 'qwen2.5-7b-instruct',
            alias: 'qwen-2.5-7b',
            description: 'Qwen2.5 7B parameter model for lightweight tasks'
        },
        {
            provider: 'qwen',
            model: 'qwen-vl-max',
            alias: 'qwen-vl-max',
            description: 'Qwen Vision-Language model for multimodal tasks'
        },
        {
            provider: 'qwen',
            model: 'qwen-vl-plus',
            alias: 'qwen-vl-plus',
            description: 'Enhanced Qwen Vision-Language model'
        },
        {
            provider: 'qwen',
            model: 'qwen-audio-turbo',
            alias: 'qwen-audio',
            description: 'Qwen Audio model for speech and audio processing'
        },
        {
            provider: 'qwen',
            model: 'qwen-turbo',
            alias: 'qwen-turbo',
            description: 'Fast Qwen model for general-purpose tasks'
        },
        {
            provider: 'qwen',
            model: 'qwen-plus',
            alias: 'qwen-plus',
            description: 'Enhanced Qwen model with improved performance'
        }
    ];

    createWorker(name: string, config: AgentModelConfig, summarizer?: AgentSummarizer, toolbox?: Toolbox): AgentWorker {
        return new QwenWorker(name, config, toolbox, summarizer);
    }
}