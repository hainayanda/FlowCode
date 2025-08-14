import { vi } from 'vitest';

/**
 * Mock Anthropic client for testing
 */
export class MockAnthropicClient {
  messages = {
    create: vi.fn()
  };
}

/**
 * Mock Anthropic stream chunk types
 */
export type MockAnthropicChunk = 
  | { type: 'content_block_start'; content_block: { type: 'text' } }
  | { type: 'content_block_start'; content_block: { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } }
  | { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } }
  | { type: 'message_delta'; usage?: { input_tokens: number; output_tokens: number } };

/**
 * Create mock stream that yields provided chunks
 */
export async function* createMockAnthropicStream(chunks: MockAnthropicChunk[]): AsyncIterable<MockAnthropicChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * Helper to create Anthropic agent config
 */
export function createAnthropicConfig() {
  return {
    model: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    apiKey: 'test-api-key',
    temperature: 0.7,
    maxTokens: 4096,
    baseUrl: 'https://api.anthropic.com'
  };
}

/**
 * Mock stream chunks for different scenarios
 */
export const mockAnthropicContentChunks: MockAnthropicChunk[] = [
  { type: 'content_block_start', content_block: { type: 'text' } },
  { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
  { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
  { type: 'content_block_delta', delta: { type: 'text_delta', text: '!' } }
];

export const mockAnthropicToolCallChunks: MockAnthropicChunk[] = [
  { 
    type: 'content_block_start', 
    content_block: { 
      type: 'tool_use',
      id: 'toolu_123',
      name: 'test_tool',
      input: { param: 'value' }
    }
  }
];

export const mockAnthropicUsageChunk: MockAnthropicChunk = {
  type: 'message_delta',
  usage: { input_tokens: 10, output_tokens: 20 }
};