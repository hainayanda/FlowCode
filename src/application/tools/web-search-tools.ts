import { Observable, EMPTY } from 'rxjs';
import { ToolDefinition, ToolCall, ToolResult, Toolbox, ToolboxMessage } from '../interfaces/toolbox.js';
import { WebSearchService, WebSearchOptions, WebSearchResponse, SearXNGInstance } from '../interfaces/web-search.js';

/**
 * Default SearXNG instances (reliable public instances)
 */
const DEFAULT_SEARXNG_INSTANCES: SearXNGInstance[] = [
  { url: 'https://search.bus-hit.me', name: 'bus-hit.me', supportsJson: true, isReliable: true },
  { url: 'https://searx.be', name: 'searx.be', supportsJson: true, isReliable: true },
  { url: 'https://searx.tiekoetter.com', name: 'tiekoetter.com', supportsJson: true, isReliable: true },
  { url: 'https://paulgo.io', name: 'paulgo.io', supportsJson: true, isReliable: true },
  { url: 'https://searx.org', name: 'searx.org', supportsJson: true, isReliable: true }
];

/**
 * SearXNG web search service implementation
 */
export class SearXNGSearchService implements WebSearchService {
  private instances: SearXNGInstance[];
  private currentInstanceIndex = 0;
  private requestTimeout = 10000; // 10 seconds

  constructor(instances: SearXNGInstance[] = DEFAULT_SEARXNG_INSTANCES) {
    this.instances = instances.filter(instance => instance.supportsJson && instance.isReliable);
  }

  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResponse> {
    const searchOptions = {
      categories: options.categories || ['general'],
      language: options.language || 'en',
      pageNumber: options.pageNumber || 1,
      timeRange: options.timeRange,
      safeSearch: options.safeSearch || 'moderate',
      maxResults: options.maxResults || 10,
      ...options
    };

    let lastError: Error | null = null;

    // Try each instance until one works
    for (let attempt = 0; attempt < this.instances.length; attempt++) {
      const instance = this.getCurrentInstance();
      
      try {
        const response = await this.performSearch(instance, query, searchOptions);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.rotateInstance();
        continue;
      }
    }

    throw new Error(`All SearXNG instances failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  private async performSearch(
    instance: SearXNGInstance, 
    query: string, 
    options: WebSearchOptions
  ): Promise<WebSearchResponse> {
    const url = new URL('/search', instance.url);
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      language: options.language || 'en',
      pageno: String(options.pageNumber || 1)
    });

    if (options.categories?.length) {
      params.append('categories', options.categories.join(','));
    }

    if (options.engines?.length) {
      params.append('engines', options.engines.join(','));
    }

    if (options.timeRange) {
      params.append('time_range', options.timeRange);
    }

    if (options.safeSearch) {
      params.append('safesearch', options.safeSearch === 'strict' ? '2' : options.safeSearch === 'moderate' ? '1' : '0');
    }

    url.search = params.toString();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'FlowCode/1.0 (Web Search Tool)',
          'Accept': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseSearchResponse(query, data, options.maxResults);

    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout for instance ${instance.name}`);
      }
      throw error;
    }
  }

  private parseSearchResponse(query: string, data: any, maxResults = 10): WebSearchResponse {
    const results = (data.results || [])
      .slice(0, maxResults)
      .map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        content: result.content || '',
        engine: result.engine || 'unknown'
      }));

    return {
      query,
      results,
      totalResults: data.number_of_results,
      searchTime: data.search_time,
      suggestions: data.suggestions || [],
      infoboxes: data.infoboxes || []
    };
  }

  private getCurrentInstance(): SearXNGInstance {
    return this.instances[this.currentInstanceIndex];
  }

  private rotateInstance(): void {
    this.currentInstanceIndex = (this.currentInstanceIndex + 1) % this.instances.length;
  }

  async getAvailableEngines(): Promise<string[]> {
    // Common SearXNG engines
    return [
      'google', 'bing', 'duckduckgo', 'yahoo', 'yandex',
      'startpage', 'qwant', 'brave', 'wikipedia', 'reddit'
    ];
  }

  async getAvailableCategories(): Promise<string[]> {
    return [
      'general', 'images', 'videos', 'news', 'map',
      'music', 'it', 'science', 'files', 'social media'
    ];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const testQuery = 'test';
      const instance = this.getCurrentInstance();
      const url = new URL('/search', instance.url);
      url.searchParams.set('q', testQuery);
      url.searchParams.set('format', 'json');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Web search tools implementation
 */
export class WebSearchTools implements Toolbox {
  readonly id = 'web_search_tools';
  readonly description = 'Web search toolbox using SearXNG for privacy-respecting search';

  /**
   * Individual toolboxes don't emit messages - this is handled by ToolboxService
   */
  readonly messages$: Observable<ToolboxMessage> = EMPTY;

  private searchService: WebSearchService;

  constructor(searchService?: WebSearchService) {
    this.searchService = searchService || new SearXNGSearchService();
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'web_search',
        description: 'Search the web using SearXNG metasearch engine',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query', required: true },
          { name: 'categories', type: 'array', description: 'Search categories (general, images, videos, news, etc.)', required: false },
          { name: 'engines', type: 'array', description: 'Specific search engines to use', required: false },
          { name: 'language', type: 'string', description: 'Language code (en, es, fr, etc.)', required: false, default: 'en' },
          { name: 'pageNumber', type: 'number', description: 'Page number for results', required: false, default: 1 },
          { name: 'timeRange', type: 'string', description: 'Time range filter (day, month, year)', required: false },
          { name: 'safeSearch', type: 'string', description: 'Safe search level (strict, moderate, off)', required: false, default: 'moderate' },
          { name: 'maxResults', type: 'number', description: 'Maximum number of results', required: false, default: 10 }
        ],
        permission: 'loose'
      },
      {
        name: 'get_search_engines',
        description: 'Get list of available search engines',
        parameters: [],
        permission: 'none'
      },
      {
        name: 'get_search_categories',
        description: 'Get list of available search categories',
        parameters: [],
        permission: 'none'
      },
      {
        name: 'check_search_availability',
        description: 'Check if web search service is available',
        parameters: [],
        permission: 'none'
      }
    ];
  }

  supportsTool(toolName: string): boolean {
    return this.getTools().some(tool => tool.name === toolName);
  }

  async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    try {
      switch (toolCall.name) {
        case 'web_search':
          const searchResult = await this.searchService.search(
            toolCall.parameters.query,
            {
              categories: toolCall.parameters.categories,
              engines: toolCall.parameters.engines,
              language: toolCall.parameters.language,
              pageNumber: toolCall.parameters.pageNumber,
              timeRange: toolCall.parameters.timeRange,
              safeSearch: toolCall.parameters.safeSearch,
              maxResults: toolCall.parameters.maxResults
            }
          );
          return { success: true, data: searchResult };

        case 'get_search_engines':
          const engines = await this.searchService.getAvailableEngines();
          return { success: true, data: { engines } };

        case 'get_search_categories':
          const categories = await this.searchService.getAvailableCategories();
          return { success: true, data: { categories } };

        case 'check_search_availability':
          const isAvailable = await this.searchService.isAvailable();
          return { success: true, data: { available: isAvailable } };

        default:
          return { success: false, error: `Unknown tool: ${toolCall.name}` };
      }
    } catch (error) {
      return {
        success: false,
        error: `Web search tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}