import TurndownService from 'turndown';
import { WebBrowser } from '../interfaces/web-browser';
import { WebSearchOptions, WebSearchResult } from '../models/web-search';

/**
 * Configuration options for the WebBrowserService
 */
export interface WebBrowserServiceConfig {
    /** Base URL of the SearXNG instance */
    searxngBaseUrl?: string;
    /** Default user agent for requests */
    userAgent?: string;
    /** Request timeout in milliseconds */
    timeout?: number;
}

/**
 * Default configuration for WebBrowserService
 */
const DEFAULT_WEB_BROWSER_CONFIG: Required<WebBrowserServiceConfig> = {
    searxngBaseUrl: 'https://searx.be',
    userAgent: 'FlowCode-WebBrowser/1.0',
    timeout: 30000,
};

/**
 * SearXNG API response structure for search results
 */
interface SearxngSearchResponse {
    query: string;
    number_of_results: number;
    results: SearxngResult[];
    answers: string[];
    corrections: string[];
    infoboxes: Array<{
        infobox: string;
        content: string;
        engine: string;
        engines: string[];
    }>;
    suggestions: string[];
    unresponsive_engines: string[];
}

/**
 * Individual search result from SearXNG API
 */
interface SearxngResult {
    url: string;
    title: string;
    content: string;
    engine: string;
    parsed_url: string[];
    template: string;
    engines: string[];
    positions: number[];
    score: number;
    category: string;
}

/**
 * WebBrowserService implementation using SearXNG for search and turndown for HTML-to-markdown conversion
 *
 * This service provides web browsing capabilities through SearXNG meta-search engine
 * and converts HTML content to markdown format for AI agent consumption.
 *
 * @example
 * ```typescript
 * // Use default configuration (searx.be instance)
 * const browser = new WebBrowserService();
 *
 * // Or provide custom configuration
 * const customBrowser = new WebBrowserService({
 *   searxngBaseUrl: 'https://searx.example.com'
 * });
 *
 * // Search for content
 * const results = await browser.search('TypeScript best practices');
 *
 * // Fetch and convert page to markdown
 * const markdown = await browser.open('https://example.com');
 * ```
 */
export class WebBrowserService implements WebBrowser {
    private readonly config: Required<WebBrowserServiceConfig>;
    private readonly turndownService: TurndownService;

    /**
     * Creates a new WebBrowserService instance
     *
     * @param config - Configuration options for the service. If not provided, uses default configuration.
     */
    constructor(config: WebBrowserServiceConfig = {}) {
        this.config = {
            ...DEFAULT_WEB_BROWSER_CONFIG,
            ...config,
        };

        this.turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            emDelimiter: '_',
            strongDelimiter: '**',
        });
    }

    /**
     * Opens a URL and returns its content converted to markdown
     *
     * @param url - The URL to fetch and convert
     * @returns Promise resolving to markdown content
     * @throws Error if the request fails or times out
     */
    async open(url: string): Promise<string> {
        try {
            const response = await this.fetchWithTimeout(url, {
                headers: {
                    'User-Agent': this.config.userAgent,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}: ${response.statusText}`
                );
            }

            const html = await response.text();
            return this.turndownService.turndown(html);
        } catch (error) {
            throw new Error(
                `Failed to open URL ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Performs a web search using SearXNG and returns results
     *
     * @param query - The search query
     * @param options - Optional search parameters
     * @returns Promise resolving to array of search results
     * @throws Error if the search request fails
     */
    async search(
        query: string,
        options?: WebSearchOptions
    ): Promise<WebSearchResult[]> {
        const searchParams = this.buildSearchParams(query, options);
        const searchUrl = `${this.config.searxngBaseUrl}/search?${searchParams}`;

        try {
            const response = await this.fetchWithTimeout(searchUrl, {
                headers: {
                    'User-Agent': this.config.userAgent,
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(
                    `SearXNG API returned ${response.status}: ${response.statusText}`
                );
            }

            const data: SearxngSearchResponse = await response.json();
            return this.convertSearxngResults(
                data.results,
                options?.maxResults
            );
        } catch (error) {
            throw new Error(
                `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private buildSearchParams(
        query: string,
        options?: WebSearchOptions
    ): string {
        const params = new URLSearchParams({
            q: query,
            format: 'json',
        });

        if (options?.engines?.length) {
            params.set('engines', options.engines.join(','));
        }

        if (options?.categories?.length) {
            params.set('categories', options.categories.join(','));
        }

        if (options?.language) {
            params.set('lang', options.language);
        }

        if (options?.pageNumber) {
            params.set('pageno', options.pageNumber.toString());
        }

        if (options?.timeRange) {
            params.set('time_range', options.timeRange);
        }

        if (options?.safeSearch) {
            params.set(
                'safesearch',
                options.safeSearch === 'strict'
                    ? '2'
                    : options.safeSearch === 'moderate'
                      ? '1'
                      : '0'
            );
        }

        return params.toString();
    }

    private convertSearxngResults(
        results: SearxngResult[],
        maxResults?: number
    ): WebSearchResult[] {
        const convertedResults = results.map((result) => ({
            title: result.title || 'No title',
            url: result.url,
            content: this.turndownService.turndown(result.content || ''),
        }));

        return maxResults
            ? convertedResults.slice(0, maxResults)
            : convertedResults;
    }

    private async fetchWithTimeout(
        url: string,
        options?: RequestInit
    ): Promise<Response> {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            this.config.timeout
        );

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
