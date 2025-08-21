import { Message } from '../models/messages';

export interface Summarizer {
    summarize(text: Message[]): Promise<string>;
}
