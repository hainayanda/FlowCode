/**
 * Web search result item
 */
export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  engine?: string;
}

/**
 * Web search response
 */
export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  totalResults?: number;
  searchTime?: number;
  suggestions?: string[];
  infoboxes?: any[];
}

/**
 * Web search options
 */
export interface WebSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageNumber?: number;
  timeRange?: 'day' | 'month' | 'year';
  safeSearch?: 'strict' | 'moderate' | 'off';
  maxResults?: number;
}

/**
 * SearXNG instance configuration
 */
export interface SearXNGInstance {
  url: string;
  name: string;
  supportsJson: boolean;
  isReliable: boolean;
}

/**
 * Web search service interface
 */
export interface WebSearchService {
  /**
   * Perform a web search
   */
  search(query: string, options?: WebSearchOptions): Promise<WebSearchResponse>;

  /**
   * Get available search engines
   */
  getAvailableEngines(): Promise<string[]>;

  /**
   * Get available categories
   */
  getAvailableCategories(): Promise<string[]>;

  /**
   * Test if the service is available
   */
  isAvailable(): Promise<boolean>;
}