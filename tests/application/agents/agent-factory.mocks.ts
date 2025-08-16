import { AgentFactory, Agent, AgentConfig, ModelDefinition } from '../../../src/application/interfaces/agent.js';
import { Toolbox } from '../../../src/application/interfaces/toolbox.js';
import { MockAgent } from './base-agent.mocks.js';

/**
 * Mock Agent Factory for testing
 */
export class MockAgentFactory implements AgentFactory {
  
  createAgentCalled = false;
  lastConfig: AgentConfig | null = null;
  lastToolbox: Toolbox | null = null;
  
  private providerName: string;
  private models: ModelDefinition[];

  constructor(providerName: string, models: ModelDefinition[] = []) {
    this.providerName = providerName;
    this.models = models;
  }

  createAgent(config: AgentConfig, toolbox: Toolbox): Agent {
    this.createAgentCalled = true;
    this.lastConfig = config;
    this.lastToolbox = toolbox;
    return new MockAgent(config, toolbox);
  }

  supportsProvider(provider: string): boolean {
    return provider === this.providerName;
  }

  getProviderName(): string {
    return this.providerName;
  }

  getModels(): ModelDefinition[] {
    return this.models;
  }

  supportsModel(modelName: string): boolean {
    return this.models.some(model => model.model === modelName || model.alias === modelName);
  }

  getModelByAlias(alias: string): ModelDefinition | null {
    return this.models.find(model => model.alias === alias) || null;
  }
}

/**
 * Helper function to create mock model definitions
 */
export function createMockModels(provider: string): ModelDefinition[] {
  return [
    {
      provider,
      model: `${provider}-model-1`,
      alias: `${provider}-basic`,
      description: `Basic ${provider} model`
    },
    {
      provider,
      model: `${provider}-model-2`,
      alias: `${provider}-advanced`,
      description: `Advanced ${provider} model`
    }
  ];
}