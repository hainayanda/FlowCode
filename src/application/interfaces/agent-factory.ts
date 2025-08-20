import { AgentModel } from "../models/agent-model";
import { AgentModelConfig, EmbeddingConfig } from "../models/config";
import { AgentEmbedder, AgentSummarizer, AgentWorker } from "./agents";
import { Toolbox } from "./toolbox";

export interface AgentFactory { 
    models: AgentModel[];
    createWorker(name: string, config: AgentModelConfig, summarizer?: AgentSummarizer, toolbox?: Toolbox): AgentWorker;
}

export interface EmbedderFactory {
    createEmbedder(config: EmbeddingConfig): AgentEmbedder;
}