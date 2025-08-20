import { AgentFactory } from "../../interfaces/agent-factory";
import { AgentSummarizer, AgentWorker } from "../../interfaces/agents";
import { Toolbox } from "../../interfaces/toolbox";
import { AgentModel } from "../../models/agent-model";
import { AgentModelConfig } from "../../models/config";
import { MoonshotWorker } from "./moonshot-worker";

export class MoonshotFactory implements AgentFactory {
    readonly models: AgentModel[] = [
        {
            provider: 'moonshot',
            model: 'kimi-k2-instruct',
            alias: 'kimi-k2',
            description: 'Latest Kimi K2 Instruct model, 1T parameter MoE with 128K context (2025)'
        },
        {
            provider: 'moonshot',
            model: 'kimi-k2-base',
            alias: 'kimi-k2-base',
            description: 'Kimi K2 Base foundation model for fine-tuning and custom solutions'
        },
        {
            provider: 'moonshot',
            model: 'kimi-k1.5',
            alias: 'kimi-k1.5',
            description: 'Kimi K1.5 model matching OpenAI o1 performance in math and coding (Jan 2025)'
        },
        {
            provider: 'moonshot',
            model: 'kimi-audio',
            alias: 'kimi-audio',
            description: 'Universal audio foundation model for speech recognition and audio-to-text chat'
        },
        {
            provider: 'moonshot',
            model: 'kimi-dev-72b',
            alias: 'kimi-dev-72b',
            description: 'Open-source coding LLM achieving 60.4% on SWE-bench Verified'
        },
        {
            provider: 'moonshot',
            model: 'kimi-vl',
            alias: 'kimi-vl',
            description: 'Vision-Language MoE model for multimodal reasoning and agent capabilities'
        },
        {
            provider: 'moonshot',
            model: 'moonshot-v1-128k',
            alias: 'moonshot-128k',
            description: 'Legacy Moonshot model with 128K context window'
        },
        {
            provider: 'moonshot',
            model: 'moonshot-v1-32k',
            alias: 'moonshot-32k',
            description: 'Legacy Moonshot model with 32K context window'
        },
        {
            provider: 'moonshot',
            model: 'moonshot-v1-8k',
            alias: 'moonshot-8k',
            description: 'Legacy Moonshot model with 8K context window'
        }
    ];

    createWorker(name: string, config: AgentModelConfig, summarizer?: AgentSummarizer, toolbox?: Toolbox): AgentWorker {
        return new MoonshotWorker(name, config, toolbox, summarizer);
    }
}