import { Message } from "./messages";

export interface AsyncControl {
    type: `continue` | `abort`;
    payload?: string[];
}

export interface AsyncControlResponse {
    messages: Message[];
    usage: { 
        inputTokens: number;
        outputTokens: number;
        toolsUsed: number;
    }
}
