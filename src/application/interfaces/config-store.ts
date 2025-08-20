import { EmbeddingConfig, FlowCodeConfig, SummarizerConfig, TaskmasterConfig } from "../models/config";

export interface ConfigReader { 
    config: FlowCodeConfig;
    taskMasterConfig: TaskmasterConfig;
    summarizerConfig: SummarizerConfig;
    embeddingConfig: EmbeddingConfig;
    
    fetchConfig(): Promise<FlowCodeConfig>;
}

export interface ConfigWriter { 
    writeConfig(config: FlowCodeConfig): Promise<void>;
    writeTaskmasterConfig(config: TaskmasterConfig): Promise<void>;
    writeSummarizerConfig(config: SummarizerConfig): Promise<void>;
    writeEmbeddingConfig(config: EmbeddingConfig): Promise<void>;
}