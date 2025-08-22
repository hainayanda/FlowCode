import {
    WebSearchOptions,
    WebSearchResult,
} from '../../../common/models/web-search';

/**
 * Interface for web browser and search operations.
 * Provides functionality to fetch web content and perform web searches.
 */
export interface WebBrowser {
    /**
     * Opens a URL and retrieves its content.
     *
     * @param url - The URL to open and fetch content from
     * @returns Promise resolving to the web page content as a string
     */
    open(url: string): Promise<string>;

    /**
     * Performs a web search with optional configuration.
     *
     * @param query - The search query string
     * @param options - Optional search configuration parameters
     * @returns Promise resolving to an array of search results
     */
    search(
        query: string,
        options?: WebSearchOptions
    ): Promise<WebSearchResult[]>;
}
