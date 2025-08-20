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
        
        // If no summarizer provided, try to create one based on config
        const effectiveSummarizer = summarizer ?? this.createSummarizer();
        
        return factory.createWorker(name, config, effectiveSummarizer, toolbox);
    }

    private createSummarizer(): AgentSummarizer | undefined {
        const summarizerConfig = this.configReader.summarizerConfig;
        
        if (!summarizerConfig?.enabled) {
            return undefined;
        }

        const factory = this.underlyingAgentFactories.find(f => 
            f.models.some(m => m.alias === summarizerConfig.model)
        );
        
        if (!factory) {
            return undefined;
        }

        const summarizerWorkerConfig: AgentModelConfig = {
            model: summarizerConfig.model,
            provider: summarizerConfig.provider,
            apiKey: summarizerConfig.apiKey,
            maxTokens: summarizerConfig.maxTokens || 4096
        };

        const summarizerWorker = factory.createWorker(`${summarizerConfig.model}-summarizer`, summarizerWorkerConfig, undefined, undefined);
        return new SummarizerWorker(summarizerWorker);
    }

    createEmbedder(config: EmbeddingConfig): AgentEmbedder {
        return this.underlyingEmbedderFactory.createEmbedder(config);
    }
}