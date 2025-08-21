import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbedderService } from '../../../src/application/services/embedder-service';
import { EmbeddingConfig } from '../../../src/application/models/config';
import {
    MockConfigReader,
    MockEmbedderFactory,
} from './embedder-service.mocks';

describe('EmbedderService', () => {
    let mockFactory: MockEmbedderFactory;
    let mockConfigReader: MockConfigReader;
    let embedderService: EmbedderService;
    let defaultEmbeddingConfig: EmbeddingConfig;

    beforeEach(() => {
        defaultEmbeddingConfig = { enabled: true };
        mockFactory = new MockEmbedderFactory();
        mockConfigReader = new MockConfigReader(defaultEmbeddingConfig);
        embedderService = new EmbedderService(mockFactory, mockConfigReader);
    });

    describe('constructor', () => {
        it('should create embedder using factory and config from configStore', () => {
            expect(mockFactory.getCreationCount()).toBe(1);
            expect(mockFactory.getCreatedEmbedders()[0]).toBeDefined();
        });

        it('should set up config listener on construction', () => {
            const initialCount = mockFactory.getCreationCount();

            // Trigger config change
            mockConfigReader.updateEmbeddingConfig({ enabled: false });

            // Should have created a new embedder
            expect(mockFactory.getCreationCount()).toBe(initialCount + 1);
        });

        it('should work with disabled embedding config', () => {
            const disabledConfig = { enabled: false };
            const mockReader = new MockConfigReader(disabledConfig);
            const service = new EmbedderService(mockFactory, mockReader);

            expect(service.isAvailable).toBe(false);
        });
    });

    describe('isAvailable', () => {
        it('should return true when embedder is available', () => {
            expect(embedderService.isAvailable).toBe(true);
        });

        it('should return false when embedding is disabled', () => {
            const disabledConfig = { enabled: false };
            const mockReader = new MockConfigReader(disabledConfig);
            const service = new EmbedderService(mockFactory, mockReader);

            expect(service.isAvailable).toBe(false);
        });

        it('should update availability when config changes', () => {
            expect(embedderService.isAvailable).toBe(true);

            // Disable embedding
            mockConfigReader.updateEmbeddingConfig({ enabled: false });
            expect(embedderService.isAvailable).toBe(false);

            // Re-enable embedding
            mockConfigReader.updateEmbeddingConfig({ enabled: true });
            expect(embedderService.isAvailable).toBe(true);
        });

        it('should return false when factory creates unavailable embedder', () => {
            const unavailableFactory = new MockEmbedderFactory(false);
            const service = new EmbedderService(
                unavailableFactory,
                mockConfigReader
            );

            expect(service.isAvailable).toBe(false);
        });
    });

    describe('embed', () => {
        it('should embed text successfully when available', async () => {
            const testText = 'test text for embedding';
            const result = await embedderService.embed(testText);

            expect(result).toEqual([0.1, 0.2, 0.3, testText.length / 100]);
        });

        it('should throw error when embedder is not available', async () => {
            // Create service with unavailable embedder
            const unavailableFactory = new MockEmbedderFactory(false);
            const service = new EmbedderService(
                unavailableFactory,
                mockConfigReader
            );

            await expect(service.embed('test')).rejects.toThrow(
                'Embedder is not available'
            );
        });

        it('should throw error when embedding is disabled', async () => {
            const disabledConfig = { enabled: false };
            const mockReader = new MockConfigReader(disabledConfig);
            const service = new EmbedderService(mockFactory, mockReader);

            await expect(service.embed('test')).rejects.toThrow(
                'Embedder is not available'
            );
        });

        it('should use new embedder after config change', async () => {
            const customFactory = new MockEmbedderFactory(
                true,
                [1.0, 2.0, 3.0]
            );
            const service = new EmbedderService(
                customFactory,
                mockConfigReader
            );

            // First embedding
            const result1 = await service.embed('test');
            expect(result1).toEqual([1.0, 2.0, 3.0, 0.04]); // 'test'.length = 4

            // Change config to trigger new embedder creation
            mockConfigReader.updateEmbeddingConfig({ enabled: true });

            // Second embedding should use new embedder
            const result2 = await service.embed('hello');
            expect(result2).toEqual([1.0, 2.0, 3.0, 0.05]); // 'hello'.length = 5

            // Should have created 2 embedders
            expect(customFactory.getCreationCount()).toBe(2);
        });

        it('should handle different text lengths correctly', async () => {
            const shortText = 'hi';
            const longText =
                'this is a much longer text for testing embeddings';

            const shortResult = await embedderService.embed(shortText);
            const longResult = await embedderService.embed(longText);

            expect(shortResult[3]).toBe(shortText.length / 100);
            expect(longResult[3]).toBe(longText.length / 100);
            expect(longResult[3]).toBeGreaterThan(shortResult[3]);
        });
    });

    describe('config change handling', () => {
        it('should recreate embedder when embedding config changes', () => {
            const initialCount = mockFactory.getCreationCount();

            // Trigger config change
            mockConfigReader.updateEmbeddingConfig({ enabled: true });

            expect(mockFactory.getCreationCount()).toBe(initialCount + 1);
        });

        it('should handle multiple config changes', () => {
            const initialCount = mockFactory.getCreationCount();

            // Multiple config changes
            mockConfigReader.updateEmbeddingConfig({ enabled: false });
            mockConfigReader.updateEmbeddingConfig({ enabled: true });
            mockConfigReader.updateEmbeddingConfig({ enabled: false });

            expect(mockFactory.getCreationCount()).toBe(initialCount + 3);
        });

        it('should maintain correct state after config changes', async () => {
            // Start enabled
            expect(embedderService.isAvailable).toBe(true);
            const result1 = await embedderService.embed('test1');
            expect(result1).toBeDefined();

            // Disable
            mockConfigReader.updateEmbeddingConfig({ enabled: false });
            expect(embedderService.isAvailable).toBe(false);
            await expect(embedderService.embed('test2')).rejects.toThrow();

            // Re-enable
            mockConfigReader.updateEmbeddingConfig({ enabled: true });
            expect(embedderService.isAvailable).toBe(true);
            const result3 = await embedderService.embed('test3');
            expect(result3).toBeDefined();
        });

        it('should not interfere with other event listeners', () => {
            const otherListener = vi.fn();
            mockConfigReader.on('embedding-config-changed', otherListener);

            // Trigger config change
            mockConfigReader.updateEmbeddingConfig({ enabled: false });

            // Both service and other listener should have been called
            expect(mockFactory.getCreationCount()).toBe(2);
            expect(otherListener).toHaveBeenCalledTimes(1);
        });
    });

    describe('error handling', () => {
        it('should handle factory errors gracefully', () => {
            const errorFactory = {
                createEmbedder: vi.fn().mockImplementation(() => {
                    throw new Error('Factory error');
                }),
            };

            expect(() => {
                new EmbedderService(errorFactory, mockConfigReader);
            }).toThrow('Factory error');
        });

        it('should handle config reader errors', async () => {
            const errorConfigReader = new MockConfigReader();
            const service = new EmbedderService(mockFactory, errorConfigReader);

            // Mock the embedder to throw an error
            const mockEmbed = vi
                .fn()
                .mockRejectedValue(new Error('Embedding failed'));
            vi.spyOn(service as any, 'embedder', 'get').mockReturnValue({
                isAvailable: true,
                embed: mockEmbed,
            });

            await expect(service.embed('test')).rejects.toThrow(
                'Embedding failed'
            );
        });
    });

    describe('integration scenarios', () => {
        it('should work correctly when config is initially disabled then enabled', async () => {
            // Start with disabled config
            const disabledReader = new MockConfigReader({ enabled: false });
            const service = new EmbedderService(mockFactory, disabledReader);

            expect(service.isAvailable).toBe(false);
            await expect(service.embed('test')).rejects.toThrow();

            // Enable embedding
            disabledReader.updateEmbeddingConfig({ enabled: true });

            expect(service.isAvailable).toBe(true);
            const result = await service.embed('test');
            expect(result).toBeDefined();
        });

        it('should handle rapid config changes without issues', async () => {
            // Rapid config changes
            for (let i = 0; i < 5; i++) {
                mockConfigReader.updateEmbeddingConfig({
                    enabled: i % 2 === 0,
                });
            }

            // Should still work correctly
            if (embedderService.isAvailable) {
                const result = await embedderService.embed('test');
                expect(result).toBeDefined();
            } else {
                await expect(embedderService.embed('test')).rejects.toThrow();
            }

            // Should have created embedders for each config change
            expect(mockFactory.getCreationCount()).toBe(6); // 1 initial + 5 changes
        });
    });
});
