import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Creates the .flowcode directory if it doesn't exist.
 *
 * @param workspaceRoot - The root directory of the workspace
 * @returns Promise that resolves when directory is ensured to exist
 * @throws Error if directory cannot be created due to permissions or other issues
 */
export async function createFlowcodeDirectoryIfNeeded(
    workspaceRoot: string
): Promise<void> {
    const flowcodeDir = path.join(workspaceRoot, '.flowcode');
    try {
        await fs.access(flowcodeDir);
    } catch {
        await fs.mkdir(flowcodeDir, { recursive: true });
    }
}
