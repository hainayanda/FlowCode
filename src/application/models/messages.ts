/**
 * Represents a generic message in the conversation flow.
 * This is the base interface for all message types in the system.
 */
export interface Message {
    /** Unique identifier for this message */
    id: string;
    /** The textual content of the message */
    content: string;
    /** Type categorizing the source and purpose of the message */
    type:
        | 'user'
        | 'system'
        | 'tool'
        | 'error'
        | 'agent'
        | 'thinking'
        | 'taskmaster'
        | 'file_operation'
        | 'prompt'
        | 'user-input'
        | 'choice'
        | 'user-choice'
        | 'summary';
    /** Identifier of who/what sent this message (user, system, agent name, etc.) */
    sender: string;
    /** When this message was created */
    timestamp: Date;
}

export interface PlainMessage extends Message {
    type: 'system' | 'user' | 'agent' | 'taskmaster' | 'summary';
}

export interface ToolsMessage extends Message {
    type: 'tool';
    /** Tool-specific metadata */
    metadata: {
        /** Name of the tool being used */
        toolName: string;
        /** Parameters passed to the tool */
        parameters: Record<string, any>;
        /** Result returned by the tool */
        result?: string;
    };
}

/**
 * System message that contains error information.
 * Used to communicate errors and exceptions within the conversation flow.
 */
export interface ErrorMessage extends Message {
    type: 'error';
    /** Error-specific metadata */
    metadata: {
        /** The error object that occurred */
        error: Error;
        /** Optional stack trace for debugging */
        stack?: string;
    };
}

/**
 * Message representing a file operation that was performed.
 * Contains detailed information about what changes were made to which files.
 *
 * Content format example:
 * ```
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
    /** File operation-specific metadata */
    metadata: {
        /** Path to the file that was modified */
        filePath: string;
        /** Array of changes made to the file */
        diffs: Array<{
            /** Line number where the change occurred */
            lineNumber: number;
            /** Type of change made */
            type: 'unchanged' | 'added' | 'removed' | 'modified';
            /** Original text before the change */
            oldText?: string;
            /** New text after the change */
            newText?: string;
        }>;
    };
}

/**
 * Message sent by the system to request user input.
 *
 * Content format: "asking user for input: <prompt>"
 */
export interface PromptMessage extends Message {
    type: 'prompt';
    /** Prompt-specific metadata */
    metadata: {
        /** The prompt text to show the user */
        prompt: string;
    };
}

/**
 * Message sent by the system to ask user to choose from multiple options.
 *
 * Content format example:
 * ```
 * asking user for choices:
 * <prompt>
 * - <choiceLabel> (<choiceValue>)
 * - <choiceLabel> (<choiceValue>)
 * ```
 */
export interface ChoiceMessage extends Message {
    type: 'choice';
    /** Choice-specific metadata */
    metadata: {
        /** The prompt text to show the user */
        prompt: string;
        /** Available choices for the user to select from */
        choices: Array<{
            /** Display label for this choice */
            label: string;
            /** Internal value for this choice */
            value: string;
        }>;
    };
}

/**
 * Message sent by the user to indicate their choice selection.
 *
 * Content format: "user has made a choice: <choiceLabel> (<choiceValue>)"
 */
export interface ChoiceInputMessage extends Message {
    type: 'user-choice';
    /** Choice input-specific metadata */
    metadata: {
        /** Index of the selected choice */
        choice: number;
        /** The available choices that were presented */
        choices: Array<{
            /** Display label for this choice */
            label: string;
            /** Internal value for this choice */
            value: string;
        }>;
    };
}

/**
 * Message sent by the user to provide text input in response to a prompt.
 *
 * Content format: "user has provided an input: <input>"
 */
export interface PromptInputMessage extends Message {
    type: 'user-input';
    /** Prompt input-specific metadata */
    metadata: {
        /** The original prompt that was shown */
        prompt: string;
        /** The user's input response */
        input: string;
    };
}
