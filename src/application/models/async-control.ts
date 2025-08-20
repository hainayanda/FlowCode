import { Message } from "./messages";

export interface AsyncControl {
    type: `continue` | `abort`;
    queuedMessages?: Message[];
    summarizedMessages?: Message[];
}

export interface AsyncControlResponse {
    messages: Message[];
    completedReason: `completed` | `aborted`;
    usage: { 
        inputTokens: number;
        outputTokens: number;
        toolsUsed: number;
    };
}
