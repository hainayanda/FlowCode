export interface WebSearchOptions {
    categories?: string[];
    engines?: string[];
    language?: string;
    pageNumber?: number;
    timeRange?: 'day' | 'month' | 'year';
    safeSearch?: 'strict' | 'moderate' | 'off';
    maxResults?: number;
}

export interface WebSearchResult {
    title: string;
    url: string;
    content: string;
}
