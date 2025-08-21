import { WebSearchOptions, WebSearchResult } from '../models/web-search';

export interface WebBrowser {
    open(url: string): Promise<string>;
    search(
        query: string,
        options?: WebSearchOptions
    ): Promise<WebSearchResult[]>;
}
