/**
 * Configuration options for web search operations.
 *
 * Provides various parameters to customize search behavior,
 * filtering, and result formatting for web search queries.
 */
export interface WebSearchOptions {
    /** Categories to filter search results by */
    categories?: string[];
    /** Search engines to use for the query */
    engines?: string[];
    /** Language preference for search results */
    language?: string;
    /** Page number for paginated results */
    pageNumber?: number;
    /** Time range filter for search results */
    timeRange?: 'day' | 'month' | 'year';
    /** Safe search filtering level */
    safeSearch?: 'strict' | 'moderate' | 'off';
    /** Maximum number of results to return */
    maxResults?: number;
}

/**
 * Individual web search result.
 *
 * Represents a single search result containing the essential
 * information needed to display and access the found content.
 */
export interface WebSearchResult {
    /** Title of the web page or search result */
    title: string;
    /** URL of the web page */
    url: string;
    /** Excerpt or summary of the page content */
    content: string;
}
