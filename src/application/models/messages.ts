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
 * Sent by the system to ask for user input.
 * content should be like:
 * "asking user for input: <prompt>"
 */
export interface PromptMessage extends Message {
    type: 'user_interaction';
    metadata: {
        prompt: string;
    }
}

/**
 * Sent by the system to ask for user choices.
 * content should be like:
 * ```
 * asking user for choices: 
 * <prompt>
 * - <choiceLabel> (<choiceValue>)
 * - <choiceLabel> (<choiceValue>)
 * ```
 */
export interface ChoiceMessage extends PromptMessage {
    type: 'user_interaction';
    metadata: {
        prompt: string;
        choices: Array<{
            label: string;
            value: string;
        }>;
    }
}

/**
 * Sent by the user to indicate their choice.
 * content should be like:
 * "user has made a choice: <choiceLabel> (<choiceValue>)"
 */
export interface ChoiceInputMessage extends Message {
    type: 'user_interaction';
    metadata: {
        choice: number,
        choices: Array<{
            label: string;
            value: string;
        }>;
    }
}

/**
 * Sent by the user to provide input.
 * content should be like:
 * user has provided an input: <input>
 */
export interface PromptInputMessage extends PromptMessage {
    type: 'user_interaction';
    metadata: {
        prompt: string;
        input: string;
    }
}