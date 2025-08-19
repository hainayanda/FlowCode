/**
 * Represents a generic message.
 * This is the base interface for all message types.
 */
export interface Message { 
    id: string;
    content: string;
    type: 'user' | 'system' | 'agent' | 'taskmaster' | 'file_operation' | 'user_interaction';
    sender: string; // user, system, <agentName>, taskmaster
    timestamp: Date;
}

/**
 */
export interface ErrorMessage extends Message {
    type: 'system';
    metadata: {
        error: Error;
        stack?: string;
    }
}

/**
 * content should be like:
 * <filepath> successfully edited (<startLine>-<endLine>)
 * from: 
 * ```
 *  <oldText> 
 * ```
 * to:
 * ```
 *  <newText>
 * ```
 */
export interface FileOperationMessage extends Message { 
    type: 'file_operation';
    metadata: {
        filePath: string;
        diffs: Array<{
            lineNumber: number;
            type: 'unchanged' | 'added' | 'removed' | 'modified';
            oldText?: string;
            newText?: string;
        }>;
    }
}

/**
 * content should be like:
 * "user has made a choice: <choiceLabel> (<choiceValue>)"
 */
export interface ChoiceInputMessage extends Message {
    type: 'user_interaction';
    metadata: {
        choices: Array<{
            label: string;
            value: string;
        }>;
    }
}

/**
 * content should be like:
 * user has provided an input: <input>
 */
export interface PromptInputMessage extends Message {
    type: 'user_interaction';
    metadata: {
        prompt: string;
    }
}