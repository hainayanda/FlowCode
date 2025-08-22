import { describe, it, expect } from 'vitest';
import {
    generateContextualDiff,
    formatContextualDiff,
    generateAppendDiff,
    generateInsertDiff,
    generateDeleteDiff,
    generateReplaceDiff,
    mergeFileOperations,
    formatMergedFileOperations,
} from '../../../src/common/utils/diff-utils';
import { ContextualDiff } from '../../../src/common/models/diff';
import { FileOperationMessage } from '../../../src/application/stores/models/messages';

describe('diff-utils', () => {
    describe('generateContextualDiff', () => {
        it('should generate diff with context lines', () => {
            const originalLines = ['line1', 'line2', 'line3', 'line4', 'line5'];
            const modifiedLines = [
                'line1',
                'line2',
                'CHANGED',
                'line4',
                'line5',
            ];
            const changes = [
                {
                    lineNumber: 3,
                    type: 'modified' as const,
                    oldText: 'line3',
                    newText: 'CHANGED',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes,
                2
            );

            expect(result.lines).toHaveLength(5); // 2 before + 1 changed + 2 after
            expect(result.lines[0]).toEqual({
                lineNumber: 1,
                type: 'unchanged',
                oldText: 'line1',
                newText: 'line1',
            });
            expect(result.lines[2]).toEqual({
                lineNumber: 3,
                type: 'modified',
                oldText: 'line3',
                newText: 'CHANGED',
            });
            expect(result.summary).toBe('~1 modified');
        });

        it('should handle multiple changes', () => {
            const originalLines = ['line1', 'line2', 'line3', 'line4', 'line5'];
            const modifiedLines = [
                'line1',
                'CHANGED2',
                'line3',
                'CHANGED4',
                'line5',
            ];
            const changes = [
                {
                    lineNumber: 2,
                    type: 'modified' as const,
                    oldText: 'line2',
                    newText: 'CHANGED2',
                },
                {
                    lineNumber: 4,
                    type: 'modified' as const,
                    oldText: 'line4',
                    newText: 'CHANGED4',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes,
                1
            );

            expect(result.lines).toHaveLength(5); // All lines included due to overlap
            expect(result.summary).toBe('~2 modified');
        });

        it('should handle added lines', () => {
            const originalLines = ['line1', 'line2'];
            const modifiedLines = ['line1', 'line2', 'NEW_LINE'];
            const changes = [
                {
                    lineNumber: 3,
                    type: 'added' as const,
                    newText: 'NEW_LINE',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes,
                1
            );

            expect(result.lines).toHaveLength(2);
            expect(result.lines[1]).toEqual({
                lineNumber: 3,
                type: 'added',
                newText: 'NEW_LINE',
            });
            expect(result.summary).toBe('+1 added');
        });

        it('should handle removed lines', () => {
            const originalLines = ['line1', 'line2', 'line3'];
            const modifiedLines = ['line1', 'line3'];
            const changes = [
                {
                    lineNumber: 2,
                    type: 'removed' as const,
                    oldText: 'line2',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes,
                1
            );

            expect(result.lines).toHaveLength(3);
            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'removed',
                oldText: 'line2',
            });
            expect(result.summary).toBe('-1 removed');
        });

        it('should limit context to file boundaries', () => {
            const originalLines = ['line1', 'line2'];
            const modifiedLines = ['CHANGED1', 'line2'];
            const changes = [
                {
                    lineNumber: 1,
                    type: 'modified' as const,
                    oldText: 'line1',
                    newText: 'CHANGED1',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes,
                5
            );

            expect(result.lines).toHaveLength(2); // Should not go beyond file boundaries
        });

        it('should generate summary for mixed changes', () => {
            const originalLines = ['line1'];
            const modifiedLines = ['line1'];
            const changes = [
                { lineNumber: 1, type: 'added' as const, newText: 'new1' },
                { lineNumber: 2, type: 'removed' as const, oldText: 'old1' },
                {
                    lineNumber: 3,
                    type: 'modified' as const,
                    oldText: 'old2',
                    newText: 'new2',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes,
                0
            );

            expect(result.summary).toBe('+1 added, -1 removed, ~1 modified');
        });
    });

    describe('formatContextualDiff', () => {
        it('should format diff with line numbers', () => {
            const diff: ContextualDiff = {
                lines: [
                    {
                        lineNumber: 1,
                        type: 'unchanged',
                        oldText: 'line1',
                        newText: 'line1',
                    },
                    {
                        lineNumber: 2,
                        type: 'modified',
                        oldText: 'line2',
                        newText: 'CHANGED',
                    },
                    {
                        lineNumber: 3,
                        type: 'unchanged',
                        oldText: 'line3',
                        newText: 'line3',
                    },
                ],
                summary: '~1 modified',
            };

            const result = formatContextualDiff(diff);

            expect(result).toContain('@@ -1,3 +1,3 @@');
            expect(result).toContain('  1 line1');
            expect(result).toContain('-  2 line2');
            expect(result).toContain('+  2 CHANGED');
            expect(result).toContain('  3 line3');
        });

        it('should format diff without line numbers', () => {
            const diff: ContextualDiff = {
                lines: [
                    {
                        lineNumber: 1,
                        type: 'unchanged',
                        oldText: 'line1',
                        newText: 'line1',
                    },
                    { lineNumber: 2, type: 'added', newText: 'NEW' },
                ],
                summary: '+1 added',
            };

            const result = formatContextualDiff(diff, false);

            expect(result).toContain(' line1');
            expect(result).toContain('+NEW');
            expect(result).not.toContain('  1');
        });

        it('should handle empty diff', () => {
            const diff: ContextualDiff = {
                lines: [],
                summary: 'no changes',
            };

            const result = formatContextualDiff(diff);

            expect(result).toBe('No changes');
        });

        it('should format added lines correctly', () => {
            const diff: ContextualDiff = {
                lines: [{ lineNumber: 1, type: 'added', newText: 'new line' }],
                summary: '+1 added',
            };

            const result = formatContextualDiff(diff);

            expect(result).toContain('+  1 new line');
        });

        it('should format removed lines correctly', () => {
            const diff: ContextualDiff = {
                lines: [
                    { lineNumber: 1, type: 'removed', oldText: 'removed line' },
                ],
                summary: '-1 removed',
            };

            const result = formatContextualDiff(diff);

            expect(result).toContain('-  1 removed line');
        });
    });

    describe('generateAppendDiff', () => {
        it('should generate diff for appending to existing file', () => {
            const originalLines = ['line1', 'line2'];
            const appendedContent = 'line3\nline4';

            const result = generateAppendDiff(
                originalLines,
                appendedContent,
                3
            );

            expect(result.lines).toHaveLength(4); // 2 context + 2 added
            expect(result.lines[2]).toEqual({
                lineNumber: 3,
                type: 'added',
                newText: 'line3',
            });
            expect(result.lines[3]).toEqual({
                lineNumber: 4,
                type: 'added',
                newText: 'line4',
            });
            expect(result.summary).toBe('+2 added');
        });

        it('should generate diff for appending to empty file', () => {
            const originalLines: string[] = [];
            const appendedContent = 'first line';

            const result = generateAppendDiff(
                originalLines,
                appendedContent,
                1
            );

            expect(result.lines).toHaveLength(1);
            expect(result.lines[0]).toEqual({
                lineNumber: 1,
                type: 'added',
                newText: 'first line',
            });
        });

        it('should handle single line append', () => {
            const originalLines = ['existing'];
            const appendedContent = 'new';

            const result = generateAppendDiff(
                originalLines,
                appendedContent,
                2
            );

            expect(result.lines).toHaveLength(2);
            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'added',
                newText: 'new',
            });
        });
    });

    describe('generateInsertDiff', () => {
        it('should generate diff for inserting at beginning', () => {
            const originalLines = ['line2', 'line3'];
            const insertedContent = 'line1';

            const result = generateInsertDiff(
                originalLines,
                insertedContent,
                1
            );

            expect(result.lines).toHaveLength(3);
            expect(result.lines[0]).toEqual({
                lineNumber: 1,
                type: 'added',
                newText: 'line1',
            });
            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'unchanged',
                oldText: 'line2',
                newText: 'line2',
            });
        });

        it('should generate diff for inserting in middle', () => {
            const originalLines = ['line1', 'line3'];
            const insertedContent = 'line2';

            const result = generateInsertDiff(
                originalLines,
                insertedContent,
                2
            );

            expect(result.lines).toHaveLength(3);
            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'added',
                newText: 'line2',
            });
        });

        it('should handle multi-line insert', () => {
            const originalLines = ['line1', 'line4'];
            const insertedContent = 'line2\nline3';

            const result = generateInsertDiff(
                originalLines,
                insertedContent,
                2
            );

            expect(result.lines).toHaveLength(4);
            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'added',
                newText: 'line2',
            });
            expect(result.lines[2]).toEqual({
                lineNumber: 3,
                type: 'added',
                newText: 'line3',
            });
            expect(result.summary).toBe('+2 added');
        });
    });

    describe('generateDeleteDiff', () => {
        it('should generate diff for deleting line', () => {
            const originalLines = ['line1', 'line2', 'line3'];

            const result = generateDeleteDiff(originalLines, 2);

            expect(result.lines).toHaveLength(3);
            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'removed',
                oldText: 'line2',
            });
            expect(result.summary).toBe('-1 removed');
        });

        it('should handle deleting first line', () => {
            const originalLines = ['line1', 'line2', 'line3'];

            const result = generateDeleteDiff(originalLines, 1);

            expect(result.lines).toHaveLength(3);
            expect(result.lines[0]).toEqual({
                lineNumber: 1,
                type: 'removed',
                oldText: 'line1',
            });
        });

        it('should handle deleting last line', () => {
            const originalLines = ['line1', 'line2', 'line3'];

            const result = generateDeleteDiff(originalLines, 3);

            expect(result.lines).toHaveLength(3);
            expect(result.lines[2]).toEqual({
                lineNumber: 3,
                type: 'removed',
                oldText: 'line3',
            });
        });

        it('should handle deleting from single line file', () => {
            const originalLines = ['only line'];

            const result = generateDeleteDiff(originalLines, 1);

            expect(result.lines).toHaveLength(1);
            expect(result.lines[0]).toEqual({
                lineNumber: 1,
                type: 'removed',
                oldText: 'only line',
            });
        });
    });

    describe('generateReplaceDiff', () => {
        it('should generate diff for replacing line', () => {
            const originalLines = ['line1', 'line2', 'line3'];

            const result = generateReplaceDiff(originalLines, 2, 'REPLACED');

            expect(result.lines).toHaveLength(3);
            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'modified',
                oldText: 'line2',
                newText: 'REPLACED',
            });
            expect(result.summary).toBe('~1 modified');
        });

        it('should handle replacing first line', () => {
            const originalLines = ['line1', 'line2'];

            const result = generateReplaceDiff(originalLines, 1, 'NEW_FIRST');

            expect(result.lines[0]).toEqual({
                lineNumber: 1,
                type: 'modified',
                oldText: 'line1',
                newText: 'NEW_FIRST',
            });
        });

        it('should handle replacing last line', () => {
            const originalLines = ['line1', 'line2'];

            const result = generateReplaceDiff(originalLines, 2, 'NEW_LAST');

            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'modified',
                oldText: 'line2',
                newText: 'NEW_LAST',
            });
        });

        it('should limit context lines correctly', () => {
            const originalLines = ['1', '2', '3', '4', '5', '6', '7'];

            const result = generateReplaceDiff(originalLines, 4, 'REPLACED', 1);

            expect(result.lines).toHaveLength(3); // 1 before + 1 changed + 1 after
            expect(result.lines[0].lineNumber).toBe(3);
            expect(result.lines[1].lineNumber).toBe(4);
            expect(result.lines[2].lineNumber).toBe(5);
        });
    });

    describe('edge cases', () => {
        it('should handle undefined oldText in changes', () => {
            const originalLines = ['line1'];
            const modifiedLines = ['line1', 'line2'];
            const changes = [
                {
                    lineNumber: 2,
                    type: 'added' as const,
                    newText: 'line2',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes
            );

            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'added',
                newText: 'line2',
            });
        });

        it('should handle undefined newText in changes', () => {
            const originalLines = ['line1', 'line2'];
            const modifiedLines = ['line1'];
            const changes = [
                {
                    lineNumber: 2,
                    type: 'removed' as const,
                    oldText: 'line2',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes
            );

            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'removed',
                oldText: 'line2',
            });
        });

        it('should handle empty lines', () => {
            const originalLines = ['line1', '', 'line3'];
            const modifiedLines = ['line1', 'FILLED', 'line3'];
            const changes = [
                {
                    lineNumber: 2,
                    type: 'modified' as const,
                    oldText: '',
                    newText: 'FILLED',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes
            );

            expect(result.lines[1]).toEqual({
                lineNumber: 2,
                type: 'modified',
                oldText: '',
                newText: 'FILLED',
            });
        });

        it('should handle zero context lines', () => {
            const originalLines = ['line1', 'line2', 'line3'];
            const modifiedLines = ['line1', 'CHANGED', 'line3'];
            const changes = [
                {
                    lineNumber: 2,
                    type: 'modified' as const,
                    oldText: 'line2',
                    newText: 'CHANGED',
                },
            ];

            const result = generateContextualDiff(
                originalLines,
                modifiedLines,
                changes,
                0
            );

            expect(result.lines).toHaveLength(1); // Only the changed line
            expect(result.lines[0]).toEqual({
                lineNumber: 2,
                type: 'modified',
                oldText: 'line2',
                newText: 'CHANGED',
            });
        });
    });

    describe('mergeFileOperations', () => {
        it('should merge operations for single file', () => {
            const messages: FileOperationMessage[] = [
                {
                    id: '1',
                    content: 'edit file',
                    type: 'file_operation',
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: {
                        filePath: '/path/to/file.ts',
                        diffs: [
                            {
                                lineNumber: 5,
                                type: 'modified',
                                oldText: 'old line',
                                newText: 'new line',
                            },
                        ],
                    },
                },
            ];

            const originalFileContents = new Map([
                [
                    '/path/to/file.ts',
                    ['line1', 'line2', 'line3', 'line4', 'old line', 'line6'],
                ],
            ]);

            const result = mergeFileOperations(messages, originalFileContents);

            expect(result).toHaveLength(1);
            expect(result[0]?.filePath).toBe('/path/to/file.ts');
            expect(result[0]?.mergedDiffs).toHaveLength(1);
            expect(result[0]?.mergedDiffs[0]?.startLine).toBe(3); // 5 - 2 context
            expect(result[0]?.mergedDiffs[0]?.endLine).toBe(6); // 5 + 1 available
        });

        it('should group operations by file', () => {
            const messages: FileOperationMessage[] = [
                {
                    id: '1',
                    content: 'edit file1',
                    type: 'file_operation',
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: {
                        filePath: '/file1.ts',
                        diffs: [
                            {
                                lineNumber: 1,
                                type: 'added',
                                newText: 'new line',
                            },
                        ],
                    },
                },
                {
                    id: '2',
                    content: 'edit file2',
                    type: 'file_operation',
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: {
                        filePath: '/file2.ts',
                        diffs: [
                            {
                                lineNumber: 1,
                                type: 'removed',
                                oldText: 'removed line',
                            },
                        ],
                    },
                },
            ];

            const result = mergeFileOperations(messages);

            expect(result).toHaveLength(2);
            expect(result.map((op) => op.filePath)).toEqual([
                '/file1.ts',
                '/file2.ts',
            ]);
        });

        it('should merge adjacent changes within 4 lines', () => {
            const messages: FileOperationMessage[] = [
                {
                    id: '1',
                    content: 'edit file',
                    type: 'file_operation',
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: {
                        filePath: '/file.ts',
                        diffs: [
                            {
                                lineNumber: 5,
                                type: 'modified',
                                oldText: 'old line 5',
                                newText: 'new line 5',
                            },
                            {
                                lineNumber: 7,
                                type: 'added',
                                newText: 'added line 7',
                            },
                        ],
                    },
                },
            ];

            const originalFileContents = new Map([
                [
                    '/file.ts',
                    [
                        'line1',
                        'line2',
                        'line3',
                        'line4',
                        'old line 5',
                        'line6',
                        'line7',
                    ],
                ],
            ]);

            const result = mergeFileOperations(messages, originalFileContents);

            expect(result[0]?.mergedDiffs).toHaveLength(1); // Should be merged into one diff
        });

        it('should create separate diffs for distant changes', () => {
            const messages: FileOperationMessage[] = [
                {
                    id: '1',
                    content: 'edit file',
                    type: 'file_operation',
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: {
                        filePath: '/file.ts',
                        diffs: [
                            {
                                lineNumber: 2,
                                type: 'modified',
                                oldText: 'old line 2',
                                newText: 'new line 2',
                            },
                            {
                                lineNumber: 10,
                                type: 'added',
                                newText: 'added line 10',
                            },
                        ],
                    },
                },
            ];

            const originalFileContents = new Map([
                [
                    '/file.ts',
                    [
                        'line1',
                        'old line 2',
                        'line3',
                        'line4',
                        'line5',
                        'line6',
                        'line7',
                        'line8',
                        'line9',
                        'line10',
                    ],
                ],
            ]);

            const result = mergeFileOperations(messages, originalFileContents);

            expect(result[0]?.mergedDiffs).toHaveLength(2); // Should create separate diffs
        });

        it('should handle empty messages', () => {
            const result = mergeFileOperations([]);
            expect(result).toHaveLength(0);
        });

        it('should handle missing original file contents', () => {
            const messages: FileOperationMessage[] = [
                {
                    id: '1',
                    content: 'edit file',
                    type: 'file_operation',
                    sender: 'system',
                    timestamp: new Date(),
                    metadata: {
                        filePath: '/file.ts',
                        diffs: [
                            {
                                lineNumber: 1,
                                type: 'added',
                                newText: 'new line',
                            },
                        ],
                    },
                },
            ];

            const result = mergeFileOperations(messages); // No original file contents

            expect(result).toHaveLength(1);
            expect(result[0]?.mergedDiffs).toHaveLength(1);
        });
    });

    describe('formatMergedFileOperations', () => {
        it('should format single file operation', () => {
            const mergedOperations = [
                {
                    filePath: '/file.ts',
                    mergedDiffs: [
                        {
                            startLine: 5,
                            endLine: 7,
                            beforeContent: 'line4\nold line\nline6',
                            afterContent: 'line4\nnew line\nline6',
                        },
                    ],
                },
            ];

            const result = formatMergedFileOperations(mergedOperations);

            expect(result).toContain('... successfully modify files');
            expect(result).toContain('before (lines 5-7):');
            expect(result).toContain('```\nline4\nold line\nline6\n```');
            expect(result).toContain('after\n```\nline4\nnew line\nline6\n```');
        });

        it('should format single line operation', () => {
            const mergedOperations = [
                {
                    filePath: '/file.ts',
                    mergedDiffs: [
                        {
                            startLine: 5,
                            endLine: 5,
                            beforeContent: 'old line',
                            afterContent: 'new line',
                        },
                    ],
                },
            ];

            const result = formatMergedFileOperations(mergedOperations);

            expect(result).toContain('before (line 5):');
        });

        it('should format multiple diffs for same file', () => {
            const mergedOperations = [
                {
                    filePath: '/file.ts',
                    mergedDiffs: [
                        {
                            startLine: 1,
                            endLine: 3,
                            beforeContent: 'old1\nold2\nold3',
                            afterContent: 'new1\nnew2\nnew3',
                        },
                        {
                            startLine: 10,
                            endLine: 12,
                            beforeContent: 'old10\nold11\nold12',
                            afterContent: 'new10\nnew11\nnew12',
                        },
                    ],
                },
            ];

            const result = formatMergedFileOperations(mergedOperations);

            expect(result).toContain('before (lines 1-3):');
            expect(result).toContain('before (lines 10-12):');
        });

        it('should handle empty operations', () => {
            const result = formatMergedFileOperations([]);
            expect(result).toBe('No file operations performed.');
        });

        it('should handle multiple files', () => {
            const mergedOperations = [
                {
                    filePath: '/file1.ts',
                    mergedDiffs: [
                        {
                            startLine: 1,
                            endLine: 1,
                            beforeContent: 'old1',
                            afterContent: 'new1',
                        },
                    ],
                },
                {
                    filePath: '/file2.ts',
                    mergedDiffs: [
                        {
                            startLine: 2,
                            endLine: 2,
                            beforeContent: 'old2',
                            afterContent: 'new2',
                        },
                    ],
                },
            ];

            const result = formatMergedFileOperations(mergedOperations);

            expect(result).toContain('... successfully modify files');
            expect(result).toContain('before (line 1):');
            expect(result).toContain('before (line 2):');
        });

        it('should handle operations with empty content', () => {
            const mergedOperations = [
                {
                    filePath: '/file.ts',
                    mergedDiffs: [
                        {
                            startLine: 1,
                            endLine: 1,
                            beforeContent: '',
                            afterContent: 'new content',
                        },
                    ],
                },
            ];

            const result = formatMergedFileOperations(mergedOperations);

            expect(result).toContain('```\n\n```'); // Empty before content
            expect(result).toContain('```\nnew content\n```'); // After content
        });
    });
});
