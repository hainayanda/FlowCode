import { AgentFactory } from "../../interfaces/agent-factory";
import { AgentSummarizer, AgentWorker } from "../../interfaces/agents";
import { Toolbox } from "../../interfaces/toolbox";
import { AgentModel } from "../../models/agent-model";
import { AgentModelConfig } from "../../models/config";
import { TogetherWorker } from "./together-worker";

export class TogetherFactory implements AgentFactory {
    readonly models: AgentModel[] = [
        {
            provider: 'together',
            model: 'deepseek-ai/deepseek-r1',
            alias: 'deepseek-r1',
            description: 'Latest DeepSeek R1 reasoning model challenging top AI at lower cost (2025)'
        },
        {
            provider: 'together',
            model: 'meta-llama/Meta-Llama-3.3-70B-Instruct',
            alias: 'llama-3.3-70b',
            description: 'Meta Llama 3.3 multilingual 70B model optimized for dialogue'
        },
        {
            provider: 'together',
            model: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
            alias: 'llama-3.1-405b',
            description: 'Largest and most capable Llama model for complex reasoning'
        },
        {
            provider: 'together',
            model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
            alias: 'llama-3.1-70b',
            description: 'High-performance Llama model for most tasks'
        },
        {
            provider: 'together',
            model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
            alias: 'llama-3.1-8b',
            description: 'Efficient Llama model for fast responses'
        },
        {
            provider: 'together',
            model: 'deepseek-ai/deepseek-v3',
            alias: 'deepseek-v3',
            description: 'Latest DeepSeek Mixture-of-Experts model challenging top AI at lower cost'
        },
        {
            provider: 'together',
            model: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
            alias: 'qwen-2.5-72b',
            description: 'Alibaba Qwen 2.5 model for multilingual tasks'
        },
        {
            provider: 'together',
            model: 'Qwen/QwenQwen3-72B-Instruct',
            alias: 'qwen-3-72b',
            description: 'Latest Qwen 3 model from Alibaba Cloud (2025)'
        },
        {
            provider: 'together',
            model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
            alias: 'mixtral-8x7b',
            description: 'Mistral Mixture-of-Experts model for efficient inference'
        },
        {
            provider: 'together',
            model: 'microsoft/WizardLM-2-8x22B',
            alias: 'wizardlm-2-8x22b',
            description: 'Microsoft WizardLM model for complex reasoning tasks'
        },
        {
            provider: 'together',
            model: 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
            alias: 'nous-hermes-2-mixtral',
            description: 'Fine-tuned Mixtral model for helpful conversations'
        },
        {
            provider: 'together',
            model: 'togethercomputer/RedPajama-INCITE-7B-Chat',
            alias: 'redpajama-7b',
            description: 'Open-source conversational model by Together'
        }
    ];

    createWorker(name: string, config: AgentModelConfig, summarizer?: AgentSummarizer, toolbox?: Toolbox): AgentWorker {
        return new TogetherWorker(name, config, toolbox, summarizer);
    }
}