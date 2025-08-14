import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSearchTools, SearXNGSearchService } from '../../../src/application/tools/web-search-tools.js';
import { 
  WebSearchService, 
  WebSearchResponse, 
  WebSearchOptions, 
  SearXNGInstance 
} from '../../../src/application/interfaces/web-search.js';
import { ToolCall } from '../../../src/application/interfaces/toolbox.js';

/**
 * Mock WebSearchService for testing
 */
class MockWebSearchService implements WebSearchService {
  public searchCalled = false;
  public lastQuery = '';
  public lastOptions: WebSearchOptions | undefined;
  public getEnginesCalled = false;
  public getCategoriesCalled = false;
  public isAvailableCalled = false;
  
  private mockResponse: WebSearchResponse = {
    query: '',
    results: [],
    totalResults: 0,
    searchTime: 0,
    suggestions: [],
    infoboxes: []
  };
  
  private mockEngines: string[] = [];
  private mockCategories: string[] = [];
  private mockAvailable = true;
  private shouldThrow = false;

  setMockResponse(response: WebSearchResponse): void {
    this.mockResponse = response;
  }

  setMockEngines(engines: string[]): void {
    this.mockEngines = engines;
  }

  setMockCategories(categories: string[]): void {
    this.mockCategories = categories;
  }

  setMockAvailable(available: boolean): void {
    this.mockAvailable = available;
  }

  setShouldThrow(shouldThrow: boolean): void {
    this.shouldThrow = shouldThrow;
  }

  async search(query: string, options?: WebSearchOptions): Promise<WebSearchResponse> {
    this.searchCalled = true;
    this.lastQuery = query;
    this.lastOptions = options;
    
    if (this.shouldThrow) {
      throw new Error('Mock search error');
    }
    
    return { ...this.mockResponse, query };
  }

  async getAvailableEngines(): Promise<string[]> {
    this.getEnginesCalled = true;
    return this.mockEngines;
  }

  async getAvailableCategories(): Promise<string[]> {
    this.getCategoriesCalled = true;
    return this.mockCategories;
  }

  async isAvailable(): Promise<boolean> {
    this.isAvailableCalled = true;
    return this.mockAvailable;
  }

  reset(): void {
    this.searchCalled = false;
    this.lastQuery = '';
    this.lastOptions = undefined;
    this.getEnginesCalled = false;
    this.getCategoriesCalled = false;
    this.isAvailableCalled = false;
    this.shouldThrow = false;
  }
}

describe('WebSearchTools', () => {
  let webSearchTools: WebSearchTools;
  let mockSearchService: MockWebSearchService;

  beforeEach(() => {
    mockSearchService = new MockWebSearchService();
    webSearchTools = new WebSearchTools(mockSearchService);
  });

  afterEach(() => {
    mockSearchService.reset();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct id and description', () => {
      expect(webSearchTools.id).toBe('web_search_tools');
      expect(webSearchTools.description).toBe('Web search toolbox using SearXNG for privacy-respecting search');
    });

    it('should initialize with default SearXNGSearchService when no service provided', () => {
      const defaultTools = new WebSearchTools();
      expect(defaultTools.id).toBe('web_search_tools');
    });
  });

  describe('Tool Definitions', () => {
    it('should provide correct tool definitions', () => {
      const tools = webSearchTools.getTools();
      
      expect(tools).toHaveLength(4);
      
      const webSearchTool = tools.find(t => t.name === 'web_search');
      expect(webSearchTool).toBeDefined();
      expect(webSearchTool?.description).toBe('Search the web using SearXNG metasearch engine');
      expect(webSearchTool?.permission).toBe('loose');
      expect(webSearchTool?.parameters).toHaveLength(8);
      
      const enginesTool = tools.find(t => t.name === 'get_search_engines');
      expect(enginesTool).toBeDefined();
      expect(enginesTool?.permission).toBe('none');
      
      const categoriesTools = tools.find(t => t.name === 'get_search_categories');
      expect(categoriesTools).toBeDefined();
      expect(categoriesTools?.permission).toBe('none');
      
      const availabilityTool = tools.find(t => t.name === 'check_search_availability');
      expect(availabilityTool).toBeDefined();
      expect(availabilityTool?.permission).toBe('none');
    });

    it('should support all defined tools', () => {
      expect(webSearchTools.supportsTool('web_search')).toBe(true);
      expect(webSearchTools.supportsTool('get_search_engines')).toBe(true);
      expect(webSearchTools.supportsTool('get_search_categories')).toBe(true);
      expect(webSearchTools.supportsTool('check_search_availability')).toBe(true);
      expect(webSearchTools.supportsTool('unknown_tool')).toBe(false);
    });
  });

  describe('Web Search Tool', () => {
    const createSearchToolCall = (query: string, options: Record<string, any> = {}): ToolCall => ({
      name: 'web_search',
      parameters: { query, ...options }
    });

    it('should execute basic web search successfully', async () => {
      const mockResponse: WebSearchResponse = {
        query: 'test query',
        results: [
          { title: 'Test Result', url: 'https://example.com', content: 'Test content' }
        ],
        totalResults: 1,
        searchTime: 0.5
      };
      
      mockSearchService.setMockResponse(mockResponse);
      
      const result = await webSearchTools.executeTool(createSearchToolCall('test query'));
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(mockSearchService.searchCalled).toBe(true);
      expect(mockSearchService.lastQuery).toBe('test query');
    });

    it('should pass search options correctly', async () => {
      const searchOptions = {
        categories: ['general', 'news'],
        engines: ['google', 'bing'],
        language: 'es',
        pageNumber: 2,
        timeRange: 'month',
        safeSearch: 'strict',
        maxResults: 20
      };
      
      mockSearchService.setMockResponse({ query: 'test', results: [] });
      
      await webSearchTools.executeTool(createSearchToolCall('test query', searchOptions));
      
      expect(mockSearchService.lastOptions).toEqual(searchOptions);
    });

    it('should handle search service errors', async () => {
      mockSearchService.setShouldThrow(true);
      
      const result = await webSearchTools.executeTool(createSearchToolCall('test query'));
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Mock search error');
    });
  });

  describe('Get Search Engines Tool', () => {
    const createEnginesToolCall = (): ToolCall => ({
      name: 'get_search_engines',
      parameters: {}
    });

    it('should get available engines successfully', async () => {
      const mockEngines = ['google', 'bing', 'duckduckgo'];
      mockSearchService.setMockEngines(mockEngines);
      
      const result = await webSearchTools.executeTool(createEnginesToolCall());
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ engines: mockEngines });
      expect(mockSearchService.getEnginesCalled).toBe(true);
    });
  });

  describe('Get Search Categories Tool', () => {
    const createCategoriesToolCall = (): ToolCall => ({
      name: 'get_search_categories',
      parameters: {}
    });

    it('should get available categories successfully', async () => {
      const mockCategories = ['general', 'images', 'videos', 'news'];
      mockSearchService.setMockCategories(mockCategories);
      
      const result = await webSearchTools.executeTool(createCategoriesToolCall());
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ categories: mockCategories });
      expect(mockSearchService.getCategoriesCalled).toBe(true);
    });
  });

  describe('Check Search Availability Tool', () => {
    const createAvailabilityToolCall = (): ToolCall => ({
      name: 'check_search_availability',
      parameters: {}
    });

    it('should check availability successfully when available', async () => {
      mockSearchService.setMockAvailable(true);
      
      const result = await webSearchTools.executeTool(createAvailabilityToolCall());
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ available: true });
      expect(mockSearchService.isAvailableCalled).toBe(true);
    });

    it('should check availability successfully when not available', async () => {
      mockSearchService.setMockAvailable(false);
      
      const result = await webSearchTools.executeTool(createAvailabilityToolCall());
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ available: false });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool execution', async () => {
      const result = await webSearchTools.executeTool({
        name: 'unknown_tool',
        parameters: {}
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: unknown_tool');
    });
  });
});

describe('SearXNGSearchService', () => {
  let searchService: SearXNGSearchService;
  
  // Mock global fetch
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    const testInstances: SearXNGInstance[] = [
      { url: 'https://test1.example.com', name: 'test1', supportsJson: true, isReliable: true },
      { url: 'https://test2.example.com', name: 'test2', supportsJson: true, isReliable: true }
    ];
    searchService = new SearXNGSearchService(testInstances);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Search Functionality', () => {
    it('should perform successful search with default options', async () => {
      const mockApiResponse = {
        results: [
          { title: 'Test Result', url: 'https://example.com', content: 'Test content', engine: 'google' }
        ],
        number_of_results: 1,
        search_time: 0.5,
        suggestions: ['test suggestion']
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      const result = await searchService.search('test query');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.query).toBe('test query');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].title).toBe('Test Result');
      expect(result.totalResults).toBe(1);
      expect(result.searchTime).toBe(0.5);
    });

    it('should handle search with custom options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      });

      const options: WebSearchOptions = {
        categories: ['general', 'news'],
        engines: ['google', 'bing'],
        language: 'es',
        pageNumber: 2,
        timeRange: 'month',
        safeSearch: 'strict',
        maxResults: 5
      };

      await searchService.search('test query', options);

      const fetchCall = mockFetch.mock.calls[0];
      const url = new URL(fetchCall[0]);
      
      expect(url.searchParams.get('q')).toBe('test query');
      expect(url.searchParams.get('categories')).toBe('general,news');
      expect(url.searchParams.get('engines')).toBe('google,bing');
      expect(url.searchParams.get('language')).toBe('es');
      expect(url.searchParams.get('pageno')).toBe('2');
      expect(url.searchParams.get('time_range')).toBe('month');
      expect(url.searchParams.get('safesearch')).toBe('2'); // strict = 2
    });

    it('should retry with next instance on failure', async () => {
      // First instance fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      // Second instance succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      });

      const result = await searchService.search('test query');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.query).toBe('test query');
    });

    it('should throw error when all instances fail', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(searchService.search('test query')).rejects.toThrow(
        'All SearXNG instances failed'
      );
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] })
      });

      const result = await searchService.search('test query');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Engine and Category Methods', () => {
    it('should return available engines', async () => {
      const engines = await searchService.getAvailableEngines();
      
      expect(engines).toContain('google');
      expect(engines).toContain('bing');
      expect(engines).toContain('duckduckgo');
    });

    it('should return available categories', async () => {
      const categories = await searchService.getAvailableCategories();
      
      expect(categories).toContain('general');
      expect(categories).toContain('images');
      expect(categories).toContain('videos');
      expect(categories).toContain('news');
    });
  });

  describe('Availability Check', () => {
    it('should return true when service is available', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      
      const available = await searchService.isAvailable();
      
      expect(available).toBe(true);
    });

    it('should return false when service is not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const available = await searchService.isAvailable();
      
      expect(available).toBe(false);
    });
  });

  describe('Response Parsing', () => {
    it('should limit results to maxResults', async () => {
      const mockApiResponse = {
        results: Array.from({ length: 20 }, (_, i) => ({
          title: `Result ${i}`,
          url: `https://example${i}.com`,
          content: `Content ${i}`
        }))
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      const result = await searchService.search('test query', { maxResults: 5 });
      
      expect(result.results).toHaveLength(5);
    });

    it('should handle missing fields gracefully', async () => {
      const mockApiResponse = {
        results: [
          { title: 'Test' }, // Missing url, content, engine
          { url: 'https://example.com' }, // Missing title, content, engine
          {} // Missing all fields
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      const result = await searchService.search('test query');
      
      expect(result.results).toHaveLength(3);
      expect(result.results[0].title).toBe('Test');
      expect(result.results[0].url).toBe('');
      expect(result.results[0].content).toBe('');
      expect(result.results[0].engine).toBe('unknown');
    });
  });
});