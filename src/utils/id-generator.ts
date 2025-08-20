/**
 * Generates a unique identifier string with the specified prefix.
 *
 * Creates a unique ID by combining a prefix with the current timestamp
 * and a random alphanumeric string. This ensures uniqueness across
 * different invocations and processes.
 *
 * @param prefix - The prefix to prepend to the generated ID
 * @returns A unique identifier string in the format: `${prefix}-${timestamp}-${randomString}`
 *
 * @example
 * ```typescript
 * const agentId = generateUniqueId('agent');
 * // Returns something like: "agent-1703123456789-a1b2c3d4e"
 *
 * const sessionId = generateUniqueId('session');
 * // Returns something like: "session-1703123456790-f5g6h7i8j"
 * ```
 */
export function generateUniqueId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
