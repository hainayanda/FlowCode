/**
 * Utility functions for generating contextual diffs for file operations.
 *
 * Provides functionality to create readable diffs with surrounding context lines
 * to help AI agents better understand file changes.
 */

import { FileOperationMessage } from '../../application/stores/models/messages';
import {
    ContextualDiff,
    DiffLine,
    MergedDiff,
    MergedFileOperation,
} from '../models/diff';

/**
 * Generates a contextual diff showing changes with surrounding unchanged lines.
 *
 * @param originalLines - The original file content split into lines
 * @param modifiedLines - The modified file content split into lines
 * @param changes - Array of line changes to highlight
 * @param contextLines - Number of context lines to show before and after changes (default: 2)
 * @returns Formatted diff with context lines
 *
 * @example
 * ```typescript
 * const original = ['line1', 'line2', 'line3', 'line4', 'line5'];
 * const modified = ['line1', 'line2', 'CHANGED', 'line4', 'line5'];
 * const changes = [{ lineNumber: 3, type: 'modified', oldText: 'line3', newText: 'CHANGED' }];
 * const diff = generateContextualDiff(original, modified, changes);
 * ```
 */
export function generateContextualDiff(
    originalLines: string[],
    modifiedLines: string[],
    changes: Array<{
        lineNumber: number;
        type: 'added' | 'removed' | 'modified';
        oldText?: string;
        newText?: string;
    }>,
    contextLines: number = 2
): ContextualDiff {
    const diffLines: DiffLine[] = [];
    const affectedLineNumbers = new Set(
        changes.map((change) => change.lineNumber)
    );

    // Find the range of lines to include (with context)
    const minAffectedLine = Math.min(...Array.from(affectedLineNumbers));
    const maxAffectedLine = Math.max(...Array.from(affectedLineNumbers));

    const startLine = Math.max(1, minAffectedLine - contextLines);
    const endLine = Math.min(
        Math.max(originalLines.length, modifiedLines.length),
        maxAffectedLine + contextLines
    );

    // Group changes by line number for easy lookup
    const changesByLine = new Map<number, (typeof changes)[0]>();
    changes.forEach((change) => {
        changesByLine.set(change.lineNumber, change);
    });

    // Generate diff lines
    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
        const change = changesByLine.get(lineNum);

        if (change) {
            // This line has changes
            const diffLine: DiffLine = {
                lineNumber: lineNum,
                type: change.type,
            };
            if (change.oldText !== undefined) diffLine.oldText = change.oldText;
            if (change.newText !== undefined) diffLine.newText = change.newText;
            diffLines.push(diffLine);
        } else {
            // Context line - for unchanged lines, use modified content (which should match original for true unchanged lines)
            const modifiedText = modifiedLines[lineNum - 1];
            const originalText = originalLines[lineNum - 1];

            // For context lines, we prefer the modified text as it represents the final state
            if (modifiedText !== undefined) {
                diffLines.push({
                    lineNumber: lineNum,
                    type: 'unchanged',
                    oldText: modifiedText,
                    newText: modifiedText,
                });
            } else if (originalText !== undefined) {
                // Fallback to original if modified doesn't exist (shouldn't happen for well-formed diffs)
                diffLines.push({
                    lineNumber: lineNum,
                    type: 'unchanged',
                    oldText: originalText,
                    newText: originalText,
                });
            }
        }
    }

    // Generate summary
    const addedCount = changes.filter((c) => c.type === 'added').length;
    const removedCount = changes.filter((c) => c.type === 'removed').length;
    const modifiedCount = changes.filter((c) => c.type === 'modified').length;

    const summaryParts: string[] = [];
    if (addedCount > 0) summaryParts.push(`+${addedCount} added`);
    if (removedCount > 0) summaryParts.push(`-${removedCount} removed`);
    if (modifiedCount > 0) summaryParts.push(`~${modifiedCount} modified`);

    const summary =
        summaryParts.length > 0 ? summaryParts.join(', ') : 'no changes';

    return {
        lines: diffLines,
        summary,
    };
}

/**
 * Formats a contextual diff as a readable string with git-style diff markers.
 *
 * @param diff - The contextual diff to format
 * @param includeLineNumbers - Whether to include line numbers (default: true)
 * @returns Formatted diff string
 *
 * @example
 * ```typescript
 * const formattedDiff = formatContextualDiff(diff);
 * console.log(formattedDiff);
 * // Output:
 * // @@ -1,5 +1,5 @@
 * //  1  line1
 * //  2  line2
 * // -3  line3
 * // +3  CHANGED
 * //  4  line4
 * //  5  line5
 * ```
 */
export function formatContextualDiff(
    diff: ContextualDiff,
    includeLineNumbers: boolean = true
): string {
    if (diff.lines.length === 0) {
        return 'No changes';
    }

    const lines: string[] = [];

    // Add diff header
    const firstLine = diff.lines[0]?.lineNumber ?? 1;
    const lastLine = diff.lines[diff.lines.length - 1]?.lineNumber ?? 1;
    const lineCount = lastLine - firstLine + 1;
    lines.push(`@@ -${firstLine},${lineCount} +${firstLine},${lineCount} @@`);

    // Add diff content
    diff.lines.forEach((diffLine) => {
        let prefix = ' '; // unchanged line
        let content = diffLine.newText || diffLine.oldText || '';

        switch (diffLine.type) {
            case 'added':
                prefix = '+';
                content = diffLine.newText || '';
                break;
            case 'removed':
                prefix = '-';
                content = diffLine.oldText || '';
                break;
            case 'modified':
                // Show both old and new for modified lines
                if (diffLine.oldText && diffLine.newText) {
                    if (includeLineNumbers) {
                        lines.push(
                            `-${diffLine.lineNumber.toString().padStart(3)} ${diffLine.oldText}`
                        );
                        lines.push(
                            `+${diffLine.lineNumber.toString().padStart(3)} ${diffLine.newText}`
                        );
                    } else {
                        lines.push(`-${diffLine.oldText}`);
                        lines.push(`+${diffLine.newText}`);
                    }
                    return; // Skip the normal processing
                }
                break;
            case 'unchanged':
                prefix = ' ';
                content = diffLine.oldText || diffLine.newText || '';
                break;
        }

        if (includeLineNumbers) {
            lines.push(
                `${prefix}${diffLine.lineNumber.toString().padStart(3)} ${content}`
            );
        } else {
            lines.push(`${prefix}${content}`);
        }
    });

    return lines.join('\n');
}

/**
 * Generates a simple contextual diff for append operations.
 *
 * @param originalLines - Original file lines
 * @param appendedContent - Content that was appended
 * @param startLineNumber - Line number where append started
 * @param contextLines - Number of context lines (default: 2)
 * @returns Contextual diff for the append operation
 */
export function generateAppendDiff(
    originalLines: string[],
    appendedContent: string,
    startLineNumber: number,
    contextLines: number = 2
): ContextualDiff {
    const appendedLines = appendedContent.split('\n');
    const changes = appendedLines.map((line, index) => ({
        lineNumber: startLineNumber + index,
        type: 'added' as const,
        newText: line,
    }));

    const modifiedLines = [...originalLines, ...appendedLines];
    return generateContextualDiff(
        originalLines,
        modifiedLines,
        changes,
        contextLines
    );
}

/**
 * Generates a contextual diff for insert operations.
 *
 * @param originalLines - Original file lines
 * @param insertedContent - Content that was inserted
 * @param insertLineNumber - Line number where insertion occurred
 * @param contextLines - Number of context lines (default: 2)
 * @returns Contextual diff for the insert operation
 */
export function generateInsertDiff(
    originalLines: string[],
    insertedContent: string,
    insertLineNumber: number,
    contextLines: number = 2
): ContextualDiff {
    const insertedLines = insertedContent.split('\n');
    const modifiedLines = [...originalLines];
    modifiedLines.splice(insertLineNumber - 1, 0, ...insertedLines);

    const changes = insertedLines.map((line, index) => ({
        lineNumber: insertLineNumber + index,
        type: 'added' as const,
        newText: line,
    }));

    return generateContextualDiff(
        originalLines,
        modifiedLines,
        changes,
        contextLines
    );
}

/**
 * Generates a contextual diff for delete operations.
 *
 * @param originalLines - Original file lines
 * @param deletedLineNumber - Line number that was deleted
 * @param contextLines - Number of context lines (default: 2)
 * @returns Contextual diff for the delete operation
 */
export function generateDeleteDiff(
    originalLines: string[],
    deletedLineNumber: number,
    contextLines: number = 2
): ContextualDiff {
    const deletedText = originalLines[deletedLineNumber - 1];
    const modifiedLines = originalLines.filter(
        (_, index) => index !== deletedLineNumber - 1
    );

    const changes = [
        {
            lineNumber: deletedLineNumber,
            type: 'removed' as const,
            ...(deletedText !== undefined && { oldText: deletedText }),
        },
    ];

    return generateContextualDiff(
        originalLines,
        modifiedLines,
        changes,
        contextLines
    );
}

/**
 * Generates a contextual diff for replace operations.
 *
 * @param originalLines - Original file lines
 * @param replacedLineNumber - Line number that was replaced
 * @param newContent - New content for the line
 * @param contextLines - Number of context lines (default: 2)
 * @returns Contextual diff for the replace operation
 */
export function generateReplaceDiff(
    originalLines: string[],
    replacedLineNumber: number,
    newContent: string,
    contextLines: number = 2
): ContextualDiff {
    const oldText = originalLines[replacedLineNumber - 1];
    const modifiedLines = [...originalLines];
    modifiedLines[replacedLineNumber - 1] = newContent;

    const changes = [
        {
            lineNumber: replacedLineNumber,
            type: 'modified' as const,
            newText: newContent,
            ...(oldText !== undefined && { oldText }),
        },
    ];

    return generateContextualDiff(
        originalLines,
        modifiedLines,
        changes,
        contextLines
    );
}

/**
 * Merges multiple FileOperationMessage objects into consolidated file operations.
 * Groups operations by file and merges adjacent line changes (within 4 lines) into unified diffs.
 *
 * @param messages - Array of FileOperationMessage objects to merge
 * @param originalFileContents - Map of file paths to their original content lines (for context)
 * @returns Array of MergedFileOperation objects grouped by file
 */
export function mergeFileOperations(
    messages: FileOperationMessage[],
    originalFileContents?: Map<string, string[]>
): MergedFileOperation[] {
    // Group messages by file path
    const fileGroups = new Map<string, FileOperationMessage[]>();

    for (const message of messages) {
        const filePath = message.metadata.filePath;
        if (!fileGroups.has(filePath)) {
            fileGroups.set(filePath, []);
        }
        fileGroups.get(filePath)!.push(message);
    }

    // Process each file group
    const mergedOperations: MergedFileOperation[] = [];

    for (const [filePath, fileMessages] of fileGroups) {
        const originalLines = originalFileContents?.get(filePath) || [];
        const mergedDiffs = mergeDiffsForFile(fileMessages, originalLines);
        mergedOperations.push({
            filePath,
            mergedDiffs,
        });
    }

    return mergedOperations;
}

/**
 * Merges diffs from multiple messages for a single file.
 * Combines adjacent changes (within 4 lines) into unified diff blocks.
 */
function mergeDiffsForFile(
    messages: FileOperationMessage[],
    originalLines: string[]
): MergedDiff[] {
    // Collect all diffs and sort by line number
    const allDiffs = messages.flatMap((msg) =>
        msg.metadata.diffs.map((diff) => ({
            lineNumber: diff.lineNumber,
            type: diff.type,
            oldText: diff.oldText || '',
            newText: diff.newText || '',
        }))
    );

    // Sort by line number
    allDiffs.sort((a, b) => a.lineNumber - b.lineNumber);

    if (allDiffs.length === 0) {
        return [];
    }

    const mergedDiffs: MergedDiff[] = [];
    let currentGroup: typeof allDiffs = [allDiffs[0]!];

    // Group adjacent changes (within 4 lines of each other)
    for (let i = 1; i < allDiffs.length; i++) {
        const prevDiff = allDiffs[i - 1]!;
        const currentDiff = allDiffs[i]!;

        if (currentDiff.lineNumber <= prevDiff.lineNumber + 4) {
            currentGroup.push(currentDiff);
        } else {
            // Process current group and start new group
            mergedDiffs.push(createMergedDiff(currentGroup, originalLines));
            currentGroup = [currentDiff];
        }
    }

    // Process the last group
    if (currentGroup.length > 0) {
        mergedDiffs.push(createMergedDiff(currentGroup, originalLines));
    }

    return mergedDiffs;
}

/**
 * Creates a MergedDiff from a group of adjacent diff entries.
 * Includes 2 unmodified lines above and below the changes for context.
 */
function createMergedDiff(
    diffGroup: Array<{
        lineNumber: number;
        type: string;
        oldText: string;
        newText: string;
    }>,
    originalLines: string[]
): MergedDiff {
    const startLine = Math.min(...diffGroup.map((d) => d.lineNumber));
    const endLine = Math.max(...diffGroup.map((d) => d.lineNumber));

    // Add 2 context lines above and below
    const contextStartLine = Math.max(1, startLine - 2);
    const contextEndLine = Math.min(originalLines.length, endLine + 2);

    // Build before and after content with context
    const beforeLines: string[] = [];
    const afterLines: string[] = [];

    // Create a map of changes for quick lookup
    const changesByLine = new Map<number, (typeof diffGroup)[0]>();
    diffGroup.forEach((diff) => {
        changesByLine.set(diff.lineNumber, diff);
    });

    for (let lineNum = contextStartLine; lineNum <= contextEndLine; lineNum++) {
        const change = changesByLine.get(lineNum);

        if (change) {
            // This line has changes
            if (change.type === 'removed' || change.type === 'modified') {
                beforeLines.push(change.oldText);
            }
            if (change.type === 'added' || change.type === 'modified') {
                afterLines.push(change.newText);
            }
            if (change.type === 'unchanged') {
                beforeLines.push(change.oldText);
                afterLines.push(change.newText);
            }
        } else {
            // Context line - use original file content
            const originalLine = originalLines[lineNum - 1] || '';
            beforeLines.push(originalLine);
            afterLines.push(originalLine);
        }
    }

    return {
        startLine: contextStartLine,
        endLine: contextEndLine,
        beforeContent: beforeLines.join('\n'),
        afterContent: afterLines.join('\n'),
    };
}

/**
 * Formats merged file operations into a human-readable message.
 *
 * @param mergedOperations - Array of merged file operations
 * @returns Formatted message string for the agent
 */
export function formatMergedFileOperations(
    mergedOperations: MergedFileOperation[]
): string {
    if (mergedOperations.length === 0) {
        return 'No file operations performed.';
    }

    const lines: string[] = [];

    lines.push(`... successfully modify files`);

    for (const operation of mergedOperations) {
        for (const diff of operation.mergedDiffs) {
            const lineRange =
                diff.startLine === diff.endLine
                    ? `line ${diff.startLine}`
                    : `lines ${diff.startLine}-${diff.endLine}`;

            lines.push(`before (${lineRange}):`);
            lines.push('```');
            lines.push(diff.beforeContent);
            lines.push('```');
            lines.push('after');
            lines.push('```');
            lines.push(diff.afterContent);
            lines.push('```');
        }
    }

    return lines.join('\n');
}
