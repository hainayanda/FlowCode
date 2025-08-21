import { Embedder, EmbedderFactory } from '../../interfaces/embedder';
import { EmbeddingConfig } from '../../models/config';
import { NomicEmbedder } from './nomic-embedder';

export class NomicFactory implements EmbedderFactory {
    createEmbedder(config: EmbeddingConfig): Embedder {
        return new NomicEmbedder(config);
    }
}
