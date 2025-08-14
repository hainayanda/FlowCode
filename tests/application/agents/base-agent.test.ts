import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAgent } from '../../../src/application/agents/base-agent.js';
import { MockAgent, MockToolbox, createMockAgentConfig } from './base-agent.mocks.js';

describe('BaseAgent', () => {
  let agent: MockAgent;
  let toolbox: MockToolbox;

  beforeEach(() => {
    toolbox = new MockToolbox();
    agent = new MockAgent(createMockAgentConfig(), toolbox);
  });

  describe('constructor', () => {
    it('should initialize with config and toolbox', () => {
      expect(agent.getProvider()).toBe('mock-provider');
    });
  });

  describe('validateConfig', () => {
    it('should return true for valid config', async () => {
      const result = await agent.validateConfig();
      expect(result).toBe(true);
    });

    it('should return false when apiKey is missing', async () => {
      const invalidConfig = { ...createMockAgentConfig(), apiKey: '' };
      const invalidAgent = new MockAgent(invalidConfig, toolbox);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false when model is missing', async () => {
      const invalidConfig = { ...createMockAgentConfig(), model: '' };
      const invalidAgent = new MockAgent(invalidConfig, toolbox);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });

    it('should return false when provider is missing', async () => {
      const invalidConfig = { ...createMockAgentConfig(), provider: '' };
      const invalidAgent = new MockAgent(invalidConfig, toolbox);
      
      const result = await invalidAgent.validateConfig();
      expect(result).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should return the provider from config', () => {
      expect(agent.getProvider()).toBe('mock-provider');
    });
  });

  describe('generateMessageId', () => {
    it('should generate unique message IDs', () => {
      const id1 = agent['generateMessageId']();
      const id2 = agent['generateMessageId']();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^msg_\d+_[a-z0-9]{9}$/);
      expect(id2).toMatch(/^msg_\d+_[a-z0-9]{9}$/);
    });
  });

  describe('getCurrentTimestamp', () => {
    it('should return a Date object', () => {
      const timestamp = agent['getCurrentTimestamp']();
      expect(timestamp).toBeInstanceOf(Date);
    });

    it('should return current time within reasonable bounds', () => {
      const before = new Date();
      const timestamp = agent['getCurrentTimestamp']();
      const after = new Date();
      
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});