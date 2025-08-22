export interface DiffLine {
    lineNumber: number;
    type: 'added' | 'removed' | 'modified' | 'unchanged';
    oldText?: string;
    newText?: string;
}

export interface ContextualDiff {
    lines: DiffLine[];
    summary: string;
} // =============================================================================
// File Operation Merger - For batch file operation message formatting
// =============================================================================
/**
 * Represents a merged diff entry with before/after content and line ranges.
 */

export interface MergedDiff {
    /** Starting line number of the change */
    startLine: number;
    /** Ending line number of the change */
    endLine: number;
    /** Original content before the change */
    beforeContent: string;
    /** New content after the change */
    afterContent: string;
}
/**
 * Represents file operations grouped by file path with merged diffs.
 */

export interface MergedFileOperation {
    /** Path to the file that was modified */
    filePath: string;
    /** Array of merged diff entries for this file */
    mergedDiffs: MergedDiff[];
}
