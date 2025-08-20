import { AgentEmbedder } from '../../interfaces/agent';
import { EmbedderFactory } from '../../interfaces/agent-factory';
import { EmbeddingConfig } from '../../models/config';
import { NomicEmbedder } from './nomic-embedder';

export class NomicFactory implements EmbedderFactory {
    createEmbedder(config: EmbeddingConfig): AgentEmbedder {
        return new NomicEmbedder(config);
    }
}
