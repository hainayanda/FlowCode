import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebBrowserService } from '../../../src/application/services/web-browser-service';
import type { WebSearchOptions } from '../../../src/application/models/web-search';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WebBrowserService', () => {
    let service: WebBrowserService;
    const config = {
        searxngBaseUrl: 'https://test-searxng.example.com',
        userAgent: 'Test-Agent/1.0',
        timeout: 5000,
    };

    beforeEach(() => {
        service = new WebBrowserService(config);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create service with provided config', () => {
            expect(service).toBeInstanceOf(WebBrowserService);
        });

        it('should use default values for optional config properties', () => {
            const minimalService = new WebBrowserService({
                searxngBaseUrl: 'https://example.com',
            });
            expect(minimalService).toBeInstanceOf(WebBrowserService);
        });

        it('should create service with no config using defaults', () => {
            const defaultService = new WebBrowserService();
            expect(defaultService).toBeInstanceOf(WebBrowserService);
        });
    });

    describe('open', () => {
        it('should fetch URL and convert HTML to markdown', async () => {
            const mockHtml = '<h1>Test Page</h1><p>This is a test page.</p>';
            const expectedMarkdown = '# Test Page\n\nThis is a test page.';

            mockFetch.mockResolvedValueOnce({
                ok: true,
                text: () => Promise.resolve(mockHtml),
            });

            const result = await service.open('https://example.com');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://example.com',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'User-Agent': 'Test-Agent/1.0',
                        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    }),
                })
            );
            expect(result).toBe(expectedMarkdown);
        });

        it('should throw error for non-OK HTTP responses', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            await expect(
                service.open('https://example.com/nonexistent')
            ).rejects.toThrow(
                'Failed to open URL https://example.com/nonexistent: HTTP 404: Not Found'
            );
        });

        it('should throw error when fetch fails', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(service.open('https://example.com')).rejects.toThrow(
                'Failed to open URL https://example.com: Network error'
            );
        });

        it('should handle timeout', async () => {
            const shortTimeoutService = new WebBrowserService({
                ...config,
                timeout: 1,
            });

            // Mock a delayed response that will be aborted
            mockFetch.mockImplementationOnce(
                () =>
                    new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            resolve({
                                ok: true,
                                text: () => Promise.resolve('<p>Too slow</p>'),
                            });
                        }, 100);

                        // Simulate AbortController signal
                        setTimeout(() => {
                            clearTimeout(timeout);
                            reject(new Error('The operation was aborted'));
                        }, 1);
                    })
            );

            await expect(
                shortTimeoutService.open('https://slow-example.com')
            ).rejects.toThrow();
        });
    });

    describe('search', () => {
        const mockSearxngResponse = {
            query: 'test query',
            number_of_results: 2,
            results: [
                {
                    url: 'https://example1.com',
                    title: 'First Result',
                    content: '<p>First result content</p>',
                    engine: 'google',
                    parsed_url: ['https', 'example1.com', '', '', '', ''],
                    template: 'default.html',
                    engines: ['google'],
                    positions: [1],
                    score: 0.95,
                    category: 'general',
                },
                {
                    url: 'https://example2.com',
                    title: 'Second Result',
                    content: '<p>Second result content</p>',
                    engine: 'bing',
                    parsed_url: ['https', 'example2.com', '', '', '', ''],
                    template: 'default.html',
                    engines: ['bing'],
                    positions: [2],
                    score: 0.85,
                    category: 'general',
                },
            ],
            answers: [],
            corrections: [],
            infoboxes: [],
            suggestions: [],
            unresponsive_engines: [],
        };

        it('should perform basic search and return results', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSearxngResponse),
            });

            const results = await service.search('test query');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://test-searxng.example.com/search?q=test+query&format=json',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'User-Agent': 'Test-Agent/1.0',
                        Accept: 'application/json',
                    }),
                })
            );

            expect(results).toHaveLength(2);
            expect(results[0]).toEqual({
                title: 'First Result',
                url: 'https://example1.com',
                content: 'First result content',
            });
            expect(results[1]).toEqual({
                title: 'Second Result',
                url: 'https://example2.com',
                content: 'Second result content',
            });
        });

        it('should apply search options correctly', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockSearxngResponse),
            });

            const options: WebSearchOptions = {
                engines: ['google', 'bing'],
                categories: ['general', 'news'],
                language: 'en',
                pageNumber: 2,
                timeRange: 'month',
                safeSearch: 'strict',
                maxResults: 1,
            };

            const results = await service.search('test query', options);

            const expectedUrl =
                'https://test-searxng.example.com/search?' +
                'q=test+query&format=json&engines=google%2Cbing&categories=general%2Cnews' +
                '&lang=en&pageno=2&time_range=month&safesearch=2';

            expect(mockFetch).toHaveBeenCalledWith(
                expectedUrl,
                expect.any(Object)
            );
            expect(results).toHaveLength(1); // maxResults applied
        });

        it('should handle different safeSearch values', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockSearxngResponse),
            });

            // Test strict
            await service.search('query', { safeSearch: 'strict' });
            expect(mockFetch).toHaveBeenLastCalledWith(
                expect.stringContaining('safesearch=2'),
                expect.any(Object)
            );

            // Test moderate
            await service.search('query', { safeSearch: 'moderate' });
            expect(mockFetch).toHaveBeenLastCalledWith(
                expect.stringContaining('safesearch=1'),
                expect.any(Object)
            );

            // Test off
            await service.search('query', { safeSearch: 'off' });
            expect(mockFetch).toHaveBeenLastCalledWith(
                expect.stringContaining('safesearch=0'),
                expect.any(Object)
            );
        });

        it('should throw error for failed search requests', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });

            await expect(service.search('test query')).rejects.toThrow(
                'Search failed: SearXNG API returned 500: Internal Server Error'
            );
        });

        it('should handle network errors during search', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            await expect(service.search('test query')).rejects.toThrow(
                'Search failed: Connection refused'
            );
        });

        it('should handle results with missing data gracefully', async () => {
            const incompleteResponse = {
                ...mockSearxngResponse,
                results: [
                    {
                        url: 'https://example.com',
                        title: '', // Empty title
                        content: '', // Empty content
                        engine: 'test',
                        parsed_url: [],
                        template: 'default.html',
                        engines: ['test'],
                        positions: [1],
                        score: 1.0,
                        category: 'general',
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(incompleteResponse),
            });

            const results = await service.search('test query');

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                title: 'No title',
                url: 'https://example.com',
                content: '',
            });
        });
    });
});
