import { describe, expect, it, vi } from 'vitest';
import { generateUniqueId } from '../../src/utils/id-generator';

describe('id-generator', () => {
    describe('generateUniqueId', () => {
        it('should generate an ID with the correct prefix', () => {
            const prefix = 'test';
            const id = generateUniqueId(prefix);

            expect(id).toMatch(new RegExp(`^${prefix}-\\d+-[a-z0-9]+$`));
        });

        it('should generate unique IDs for the same prefix', () => {
            const prefix = 'user';
            const id1 = generateUniqueId(prefix);
            const id2 = generateUniqueId(prefix);

            expect(id1).not.toBe(id2);
            expect(id1).toMatch(new RegExp(`^${prefix}-`));
            expect(id2).toMatch(new RegExp(`^${prefix}-`));
        });

        it('should generate unique IDs for different prefixes', () => {
            const id1 = generateUniqueId('agent');
            const id2 = generateUniqueId('user');

            expect(id1).not.toBe(id2);
            expect(id1).toMatch(/^agent-/);
            expect(id2).toMatch(/^user-/);
        });

        it('should handle empty prefix', () => {
            const id = generateUniqueId('');

            expect(id).toMatch(/^-\d+-[a-z0-9]+$/);
        });

        it('should handle special characters in prefix', () => {
            const prefix = 'test-agent_123';
            const id = generateUniqueId(prefix);

            expect(id).toMatch(
                new RegExp(
                    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+-[a-z0-9]+$`
                )
            );
        });

        it('should include timestamp component', () => {
            const beforeTimestamp = Date.now();
            const id = generateUniqueId('test');
            const afterTimestamp = Date.now();

            const parts = id.split('-');
            const timestamp = parseInt(parts[1]);

            expect(timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
            expect(timestamp).toBeLessThanOrEqual(afterTimestamp);
        });

        it('should include random component', () => {
            const id = generateUniqueId('test');
            const parts = id.split('-');
            const randomComponent = parts[2];

            expect(randomComponent).toBeDefined();
            expect(randomComponent.length).toBe(9);
            expect(randomComponent).toMatch(/^[a-z0-9]+$/);
        });

        it('should generate different random components', () => {
            // Mock Date.now to return same value to isolate random component
            const mockNow = 1234567890000;
            const originalDateNow = Date.now;
            Date.now = vi.fn(() => mockNow);

            const id1 = generateUniqueId('test');
            const id2 = generateUniqueId('test');

            const randomPart1 = id1.split('-')[2];
            const randomPart2 = id2.split('-')[2];

            expect(randomPart1).not.toBe(randomPart2);

            // Restore original Date.now
            Date.now = originalDateNow;
        });

        it('should maintain format consistency', () => {
            const ids = Array.from({ length: 100 }, () =>
                generateUniqueId('test')
            );

            ids.forEach((id) => {
                // The random component is created by substring(2, 11), which gives up to 9 characters
                // but could be shorter if Math.random() generates fewer characters
                expect(id).toMatch(/^test-\d+-[a-z0-9]+$/);
                const parts = id.split('-');
                expect(parts).toHaveLength(3);
                expect(parts[2].length).toBeGreaterThan(0);
                expect(parts[2].length).toBeLessThanOrEqual(9);
            });
        });

        it('should handle very long prefix', () => {
            const longPrefix = 'a'.repeat(1000);
            const id = generateUniqueId(longPrefix);

            expect(id).toMatch(new RegExp(`^${longPrefix}-\\d+-[a-z0-9]+$`));
        });
    });
});
