import { vi } from 'vitest';
import OpenAI from 'openai';

/**
 * Mock OpenAI client for testing
 */
export class MockOpenAIClient {
  chat = {
    completions: {
      create: vi.fn()
    }
  };
}

/**
 * Mock OpenAI stream chunk
 */
export interface MockStreamChunk {
  choices: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
}

/**
 * Create mock stream that yields provided chunks
 */
export async function* createMockStream(chunks: MockStreamChunk[]): AsyncIterable<MockStreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * Helper to create OpenAI agent config
 */
export function createOpenAIConfig() {
  return {
    model: 'gpt-4',
    provider: 'openai',
    apiKey: 'test-api-key',
    temperature: 0.7,
    maxTokens: 4096,
    baseUrl: 'https://api.openai.com/v1'
  };
}

/**
 * Mock stream chunks for different scenarios
 */
export const mockContentChunks: MockStreamChunk[] = [
  { choices: [{ delta: { content: 'Hello' } }] },
  { choices: [{ delta: { content: ' world' } }] },
  { choices: [{ delta: { content: '!' } }] }
];

export const mockToolCallChunks: MockStreamChunk[] = [
  { 
    choices: [{ 
      delta: { 
        tool_calls: [{ 
          id: 'call_123',
          function: { 
            name: 'test_tool',
            arguments: '{"param": "value"}'
          }
        }] 
      } 
    }] 
  }
];

export const mockEmptyChunk: MockStreamChunk = { choices: [{}] };