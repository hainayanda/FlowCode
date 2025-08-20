import { AgentFactory, EmbedderFactory } from "../interfaces/agent-factory";
import { AgentSummarizer, AgentWorker, AgentEmbedder } from "../interfaces/agents";
import { ConfigReader } from "../interfaces/config-store";
import { Toolbox } from "../interfaces/toolbox";
import { AgentModel } from "../models/agent-model";
import { AgentModelConfig, EmbeddingConfig } from "../models/config";
import { SummarizerWorker } from "./summarizer-worker";

export class AgentRegistry implements AgentFactory, EmbedderFactory { 

    private underlyingAgentFactories: AgentFactory[]
    private underlyingEmbedderFactory: EmbedderFactory;
    private configReader: ConfigReader;

    get models(): AgentModel[] {
        return this.underlyingAgentFactories.flatMap(factory => factory.models);
    }

    constructor(agentFactories: AgentFactory[], embedderFactory: EmbedderFactory, configReader: ConfigReader) {
        this.underlyingAgentFactories = agentFactories;
        this.underlyingEmbedderFactory = embedderFactory;
        this.configReader = configReader;
    }

    createWorker(name: string, config: AgentModelConfig, summarizer?: AgentSummarizer, toolbox?: Toolbox): AgentWorker {
        const factory = this.underlyingAgentFactories.find(f => f.models.some(m => m.alias === config.model));
        if (!factory) throw new Error(`No factory found for model ${config.model}`);
        const summarizerUsed = summarizer || this.createSummarizer();
        return factory.createWorker(name, config, summarizerUsed || undefined, toolbox);
    }

    createEmbedder(config: EmbeddingConfig): AgentEmbedder {
        return this.underlyingEmbedderFactory.createEmbedder(config);
    }

    private createSummarizer(): AgentSummarizer | null {
        const summarizerConfig = this.configReader.summarizerConfig;
        if (!summarizerConfig.enabled) return null;
        const factory = this.underlyingAgentFactories.find(f => f.models.some(m => m.alias === summarizerConfig.model));
        if (!factory) return null;
        const worker = factory.createWorker("summarizer", summarizerConfig);
        return new SummarizerWorker(worker);
    }
}