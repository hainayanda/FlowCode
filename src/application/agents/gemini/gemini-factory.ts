import { AgentFactory } from "../../interfaces/agent-factory";
import { AgentSummarizer, AgentWorker } from "../../interfaces/agents";
import { Toolbox } from "../../interfaces/toolbox";
import { AgentModel } from "../../models/agent-model";
import { AgentModelConfig } from "../../models/config";
import { GeminiWorker } from "./gemini-worker";

export class GeminiFactory implements AgentFactory {
    readonly models: AgentModel[] = [
        {
            provider: 'google',
            model: 'gemini-2.5-pro',
            alias: 'gemini-2.5-pro',
            description: 'Most intelligent Gemini model with 2M token context and thinking capabilities (2025)'
        },
        {
            provider: 'google',
            model: 'gemini-2.5-flash',
            alias: 'gemini-2.5-flash',
            description: 'Workhorse thinking model for fast performance on everyday tasks'
        },
        {
            provider: 'google',
            model: 'gemini-2.5-flash-lite',
            alias: 'gemini-2.5-flash-lite',
            description: 'Most cost-efficient and fastest Gemini model (Aug 2025)'
        },
        {
            provider: 'google',
            model: 'gemini-2.0-flash',
            alias: 'gemini-2.0-flash',
            description: 'Next-gen features with superior speed and 1M token context'
        },
        {
            provider: 'google',
            model: 'gemini-2.0-flash-lite',
            alias: 'gemini-2.0-flash-lite',
            description: 'Optimized for cost efficiency and low latency'
        },
        {
            provider: 'google',
            model: 'gemini-2.0-pro-experimental',
            alias: 'gemini-2.0-pro-exp',
            description: 'Best model for coding performance with 2M token context'
        },
        {
            provider: 'google',
            model: 'gemini-2.0-flash-thinking-experimental',
            alias: 'gemini-2.0-flash-thinking',
            description: 'Gemini 2.0 Flash with experimental thinking capabilities'
        },
        {
            provider: 'google',
            model: 'gemini-1.5-pro',
            alias: 'gemini-1.5-pro',
            description: 'Legacy Gemini Pro model for general tasks'
        },
        {
            provider: 'google',
            model: 'gemini-1.5-flash',
            alias: 'gemini-1.5-flash',
            description: 'Legacy Gemini Flash model for fast responses'
        }
    ];

    createWorker(name: string, config: AgentModelConfig, summarizer?: AgentSummarizer, toolbox?: Toolbox): AgentWorker {
        return new GeminiWorker(name, config, toolbox, summarizer);
    }
}