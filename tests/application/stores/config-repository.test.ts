import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigRepository } from '../../../src/application/stores/config-repository';
import {
    FlowCodeConfig,
    TaskmasterConfig,
    SummarizerConfig,
    EmbeddingConfig,
    AgentModelConfig,
} from '../../../src/application/models/config';

describe('ConfigRepository', () => {
    const testWorkspaceRoot = path.join(__dirname, 'test-workspace-config');
    const configDir = path.join(testWorkspaceRoot, '.flowcode');
    const configPath = path.join(configDir, 'config.json');
    let repository: ConfigRepository;

    const mockConfig: FlowCodeConfig = {
        version: '1.0.0',
        taskmaster: {
            model: 'gpt-4',
            provider: 'openai',
            maxContext: 100,
            minContext: 5,
        },
        summarizer: {
            enabled: true,
            model: 'gpt-3.5-turbo',
            provider: 'openai',
            apiKey: 'test-key',
            maxTokens: 1000,
        },
        embedding: {
            enabled: false,
        },
        agents: {
            'test-agent': {
                model: 'gpt-4',
                provider: 'openai',
                apiKey: 'test-agent-key',
                maxTokens: 2000,
            },
        },
    };

    const defaultConfig: FlowCodeConfig = {
        version: '1.0.0',
        embedding: {
            enabled: true,
        },
    };

    beforeEach(() => {
        repository = new ConfigRepository(testWorkspaceRoot);
    });

    afterEach(async () => {
        try {
            await fs.rm(testWorkspaceRoot, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('constructor', () => {
        it('should create repository with default workspace root', () => {
            const defaultRepo = new ConfigRepository();
            expect(defaultRepo).toBeInstanceOf(ConfigRepository);
        });

        it('should create repository with custom workspace root', () => {
            expect(repository).toBeInstanceOf(ConfigRepository);
        });
    });

    describe('fetchConfig', () => {
        it('should read and parse config file successfully', async () => {
            await fs.mkdir(configDir, { recursive: true });
            await fs.writeFile(configPath, JSON.stringify(mockConfig, null, 2));

            const result = await repository.fetchConfig();

            expect(result).toEqual(mockConfig);
            expect(repository.config).toEqual(mockConfig);
        });

        it('should throw error when config file does not exist', async () => {
            await expect(repository.fetchConfig()).rejects.toThrow(
                `Configuration file not found at ${configPath}`
            );
        });

        it('should throw error when config file contains invalid JSON', async () => {
            await fs.mkdir(configDir, { recursive: true });
            await fs.writeFile(configPath, 'invalid json');

            await expect(repository.fetchConfig()).rejects.toThrow(
                'Failed to read configuration:'
            );
        });

        it('should create .flowcode directory if it does not exist', async () => {
            await fs.mkdir(configDir, { recursive: true });
            await fs.writeFile(configPath, JSON.stringify(mockConfig, null, 2));

            await repository.fetchConfig();

            const stats = await fs.stat(configDir);
            expect(stats.isDirectory()).toBe(true);
        });
    });

    describe('config getters', () => {
        it('should return default config when not loaded', () => {
            expect(repository.config).toEqual(defaultConfig);
            expect(repository.taskMasterConfig).toBeUndefined();
            expect(repository.summarizerConfig).toBeUndefined();
            expect(repository.embeddingConfig).toEqual(defaultConfig.embedding);
            expect(repository.agentConfig).toEqual({});
            expect(repository.isInitialized).toBe(false);
        });

        describe('after loading config file', () => {
            beforeEach(async () => {
                await fs.mkdir(configDir, { recursive: true });
                await fs.writeFile(
                    configPath,
                    JSON.stringify(mockConfig, null, 2)
                );
                await repository.fetchConfig();
            });

            it('should return loaded config', () => {
                expect(repository.config).toEqual(mockConfig);
            });

            it('should return taskmaster config', () => {
                expect(repository.taskMasterConfig).toEqual(
                    mockConfig.taskmaster
                );
            });

            it('should return summarizer config', () => {
                expect(repository.summarizerConfig).toEqual(
                    mockConfig.summarizer
                );
            });

            it('should return embedding config', () => {
                expect(repository.embeddingConfig).toEqual(
                    mockConfig.embedding
                );
            });

            it('should return agent config', () => {
                expect(repository.agentConfig).toEqual(mockConfig.agents);
            });

            it('should return isInitialized as true when taskmaster and agents are configured', () => {
                expect(repository.isInitialized).toBe(true);
            });
        });
    });

    describe('writeConfig', () => {
        it('should write config to file and refresh cache', async () => {
            const newConfig: FlowCodeConfig = {
                ...mockConfig,
                version: '2.0.0',
            };

            await repository.writeConfig(newConfig);

            const fileContent = await fs.readFile(configPath, 'utf-8');
            const parsedConfig = JSON.parse(fileContent);
            expect(parsedConfig).toEqual(newConfig);
            expect(repository.config).toEqual(newConfig);
        });

        it('should create directory if it does not exist', async () => {
            await repository.writeConfig(mockConfig);

            const stats = await fs.stat(configDir);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should format JSON with proper indentation', async () => {
            await repository.writeConfig(mockConfig);

            const fileContent = await fs.readFile(configPath, 'utf-8');
            expect(fileContent).toContain('  "version"');
            expect(fileContent).toContain('    "model"');
        });
    });

    describe('isInitialized', () => {
        it('should return false when only taskmaster is configured', async () => {
            const configWithOnlyTaskmaster: FlowCodeConfig = {
                version: '1.0.0',
                taskmaster: {
                    model: 'gpt-4',
                    provider: 'openai',
                    maxContext: 100,
                    minContext: 5,
                },
                embedding: {
                    enabled: true,
                },
            };

            await repository.writeConfig(configWithOnlyTaskmaster);
            expect(repository.isInitialized).toBe(false);
        });

        it('should return false when only agents are configured', async () => {
            const configWithOnlyAgents: FlowCodeConfig = {
                version: '1.0.0',
                embedding: {
                    enabled: true,
                },
                agents: {
                    'test-agent': {
                        model: 'gpt-4',
                        provider: 'openai',
                        apiKey: 'test-key',
                        maxTokens: 1000,
                    },
                },
            };

            await repository.writeConfig(configWithOnlyAgents);
            expect(repository.isInitialized).toBe(false);
        });

        it('should return false when agents is empty object', async () => {
            const configWithEmptyAgents: FlowCodeConfig = {
                version: '1.0.0',
                taskmaster: {
                    model: 'gpt-4',
                    provider: 'openai',
                    maxContext: 100,
                    minContext: 5,
                },
                embedding: {
                    enabled: true,
                },
                agents: {},
            };

            await repository.writeConfig(configWithEmptyAgents);
            expect(repository.isInitialized).toBe(false);
        });

        it('should return true when both taskmaster and agents are configured', async () => {
            await repository.writeConfig(mockConfig);
            expect(repository.isInitialized).toBe(true);
        });
    });

    describe('fetch methods', () => {
        beforeEach(async () => {
            await fs.mkdir(configDir, { recursive: true });
            await fs.writeFile(configPath, JSON.stringify(mockConfig, null, 2));
        });

        describe('fetchTaskmasterConfig', () => {
            it('should fetch and return taskmaster config from file', async () => {
                const result = await repository.fetchTaskmasterConfig();
                expect(result).toEqual(mockConfig.taskmaster);
            });

            it('should return undefined when taskmaster config is not set', async () => {
                const configWithoutTaskmaster = { ...mockConfig };
                delete configWithoutTaskmaster.taskmaster;
                await fs.writeFile(
                    configPath,
                    JSON.stringify(configWithoutTaskmaster, null, 2)
                );

                const result = await repository.fetchTaskmasterConfig();
                expect(result).toBeUndefined();
            });
        });

        describe('fetchSummarizerConfig', () => {
            it('should fetch and return summarizer config from file', async () => {
                const result = await repository.fetchSummarizerConfig();
                expect(result).toEqual(mockConfig.summarizer);
            });

            it('should return undefined when summarizer config is not set', async () => {
                const configWithoutSummarizer = { ...mockConfig };
                delete configWithoutSummarizer.summarizer;
                await fs.writeFile(
                    configPath,
                    JSON.stringify(configWithoutSummarizer, null, 2)
                );

                const result = await repository.fetchSummarizerConfig();
                expect(result).toBeUndefined();
            });
        });

        describe('fetchEmbeddingConfig', () => {
            it('should fetch and return embedding config from file', async () => {
                const result = await repository.fetchEmbeddingConfig();
                expect(result).toEqual(mockConfig.embedding);
            });
        });

        describe('fetchAgentConfig', () => {
            it('should fetch and return specific agent config from file', async () => {
                const result = await repository.fetchAgentConfig('test-agent');
                expect(result).toEqual(mockConfig.agents!['test-agent']);
            });

            it('should return undefined for non-existent agent', async () => {
                const result =
                    await repository.fetchAgentConfig('non-existent-agent');
                expect(result).toBeUndefined();
            });

            it('should return undefined when no agents are configured', async () => {
                const configWithoutAgents = { ...mockConfig };
                delete configWithoutAgents.agents;
                await fs.writeFile(
                    configPath,
                    JSON.stringify(configWithoutAgents, null, 2)
                );

                const result = await repository.fetchAgentConfig('test-agent');
                expect(result).toBeUndefined();
            });
        });
    });

    describe('getAgentConfig', () => {
        beforeEach(async () => {
            await fs.mkdir(configDir, { recursive: true });
            await fs.writeFile(configPath, JSON.stringify(mockConfig, null, 2));
            await repository.fetchConfig();
        });

        it('should return specific agent config from cached config', () => {
            const result = repository.getAgentConfig('test-agent');
            expect(result).toEqual(mockConfig.agents!['test-agent']);
        });

        it('should return undefined for non-existent agent', () => {
            const result = repository.getAgentConfig('non-existent-agent');
            expect(result).toBeUndefined();
        });

        it('should return undefined when no agents are configured', () => {
            const freshRepository = new ConfigRepository(testWorkspaceRoot);
            const result = freshRepository.getAgentConfig('test-agent');
            expect(result).toBeUndefined();
        });
    });

    describe('writeTaskmasterConfig', () => {
        beforeEach(async () => {
            await repository.writeConfig(mockConfig);
        });

        it('should update only taskmaster config', async () => {
            const newTaskmasterConfig: TaskmasterConfig = {
                model: 'claude-3',
                provider: 'anthropic',
                maxContext: 200,
                minContext: 10,
            };

            await repository.writeTaskmasterConfig(newTaskmasterConfig);

            expect(repository.taskMasterConfig).toEqual(newTaskmasterConfig);
            expect(repository.summarizerConfig).toEqual(mockConfig.summarizer);
            expect(repository.embeddingConfig).toEqual(mockConfig.embedding);
        });

        it('should work when starting from default config', async () => {
            const freshRepository = new ConfigRepository(testWorkspaceRoot);
            const newTaskmasterConfig: TaskmasterConfig = {
                model: 'claude-3',
                provider: 'anthropic',
                maxContext: 200,
                minContext: 10,
            };

            await freshRepository.writeTaskmasterConfig(newTaskmasterConfig);

            expect(freshRepository.taskMasterConfig).toEqual(
                newTaskmasterConfig
            );
            expect(freshRepository.summarizerConfig).toBeUndefined();
            expect(freshRepository.embeddingConfig).toEqual(
                defaultConfig.embedding
            );
        });
    });

    describe('writeSummarizerConfig', () => {
        beforeEach(async () => {
            await repository.writeConfig(mockConfig);
        });

        it('should update only summarizer config', async () => {
            const newSummarizerConfig: SummarizerConfig = {
                enabled: false,
                model: 'claude-3',
                provider: 'anthropic',
                apiKey: 'new-key',
                maxTokens: 2000,
            };

            await repository.writeSummarizerConfig(newSummarizerConfig);

            expect(repository.summarizerConfig).toEqual(newSummarizerConfig);
            expect(repository.taskMasterConfig).toEqual(mockConfig.taskmaster);
            expect(repository.embeddingConfig).toEqual(mockConfig.embedding);
        });

        it('should work when starting from default config', async () => {
            const freshRepository = new ConfigRepository(testWorkspaceRoot);
            const newSummarizerConfig: SummarizerConfig = {
                enabled: true,
                model: 'gpt-4',
                provider: 'openai',
                apiKey: 'test-key',
                maxTokens: 1500,
            };

            await freshRepository.writeSummarizerConfig(newSummarizerConfig);

            expect(freshRepository.summarizerConfig).toEqual(
                newSummarizerConfig
            );
            expect(freshRepository.taskMasterConfig).toBeUndefined();
            expect(freshRepository.embeddingConfig).toEqual(
                defaultConfig.embedding
            );
        });
    });

    describe('writeEmbeddingConfig', () => {
        beforeEach(async () => {
            await repository.writeConfig(mockConfig);
        });

        it('should update only embedding config', async () => {
            const newEmbeddingConfig: EmbeddingConfig = {
                enabled: true,
            };

            await repository.writeEmbeddingConfig(newEmbeddingConfig);

            expect(repository.embeddingConfig).toEqual(newEmbeddingConfig);
            expect(repository.taskMasterConfig).toEqual(mockConfig.taskmaster);
            expect(repository.summarizerConfig).toEqual(mockConfig.summarizer);
        });

        it('should work when starting from default config', async () => {
            const freshRepository = new ConfigRepository(testWorkspaceRoot);
            const newEmbeddingConfig: EmbeddingConfig = {
                enabled: false,
            };

            await freshRepository.writeEmbeddingConfig(newEmbeddingConfig);

            expect(freshRepository.embeddingConfig).toEqual(newEmbeddingConfig);
            expect(freshRepository.taskMasterConfig).toBeUndefined();
            expect(freshRepository.summarizerConfig).toBeUndefined();
        });
    });

    describe('writeAgentConfig', () => {
        beforeEach(async () => {
            await repository.writeConfig(mockConfig);
        });

        it('should add new agent config', async () => {
            const newAgentConfig: AgentModelConfig = {
                model: 'claude-3',
                provider: 'anthropic',
                apiKey: 'new-agent-key',
                maxTokens: 1500,
            };

            await repository.writeAgentConfig('new-agent', newAgentConfig);

            expect(repository.agentConfig['new-agent']).toEqual(newAgentConfig);
            expect(repository.agentConfig['test-agent']).toEqual(
                mockConfig.agents!['test-agent']
            );
            expect(repository.taskMasterConfig).toEqual(mockConfig.taskmaster);
            expect(repository.summarizerConfig).toEqual(mockConfig.summarizer);
            expect(repository.embeddingConfig).toEqual(mockConfig.embedding);
        });

        it('should update existing agent config', async () => {
            const updatedAgentConfig: AgentModelConfig = {
                model: 'gpt-3.5-turbo',
                provider: 'openai',
                apiKey: 'updated-key',
                maxTokens: 3000,
            };

            await repository.writeAgentConfig('test-agent', updatedAgentConfig);

            expect(repository.agentConfig['test-agent']).toEqual(
                updatedAgentConfig
            );
            expect(repository.taskMasterConfig).toEqual(mockConfig.taskmaster);
            expect(repository.summarizerConfig).toEqual(mockConfig.summarizer);
            expect(repository.embeddingConfig).toEqual(mockConfig.embedding);
        });

        it('should work when starting from default config', async () => {
            const freshRepository = new ConfigRepository(testWorkspaceRoot);
            const newAgentConfig: AgentModelConfig = {
                model: 'claude-3',
                provider: 'anthropic',
                apiKey: 'fresh-key',
                maxTokens: 2000,
            };

            await freshRepository.writeAgentConfig('my-agent', newAgentConfig);

            expect(freshRepository.agentConfig['my-agent']).toEqual(
                newAgentConfig
            );
            expect(freshRepository.taskMasterConfig).toBeUndefined();
            expect(freshRepository.summarizerConfig).toBeUndefined();
            expect(freshRepository.embeddingConfig).toEqual(
                defaultConfig.embedding
            );
        });
    });

    describe('error handling', () => {
        it('should handle file write permissions error', async () => {
            // Create a read-only directory to simulate permission error
            await fs.mkdir(configDir, { recursive: true });
            await fs.chmod(configDir, 0o444);

            await expect(repository.writeConfig(mockConfig)).rejects.toThrow(
                'Failed to write configuration:'
            );

            // Restore permissions for cleanup
            await fs.chmod(configDir, 0o755);
        });
    });
});
