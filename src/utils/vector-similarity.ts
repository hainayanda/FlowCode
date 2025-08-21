/**
 * Utility functions for vector similarity calculations.
 */

/**
 * Calculate cosine similarity between two vectors.
 *
 * @param vectorA - First vector
 * @param vectorB - Second vector
 * @returns Similarity score between 0 and 1
 */
export function calculateCosineSimilarity(
    vectorA: number[],
    vectorB: number[]
): number {
    if (vectorA.length !== vectorB.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
        dotProduct += vectorA[i]! * vectorB[i]!;
        normA += vectorA[i]! * vectorA[i]!;
        normB += vectorB[i]! * vectorB[i]!;
    }

    if (normA === 0 || normB === 0) {
        return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate cosine similarity between two vector buffers.
 *
 * @param bufferA - First vector buffer
 * @param bufferB - Second vector buffer
 * @returns Similarity score between 0 and 1
 */
export function calculateCosineSimilarityFromBuffers(
    bufferA: Buffer,
    bufferB: Buffer
): number {
    const vectorA = Array.from(new Float32Array(bufferA.buffer));
    const vectorB = Array.from(new Float32Array(bufferB.buffer));

    return calculateCosineSimilarity(vectorA, vectorB);
}
