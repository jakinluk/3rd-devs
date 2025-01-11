import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

interface ScrapingResult {
    markdown: string;
    links: string[];
}

export async function scrapeWebpage(url: string): Promise<ScrapingResult> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove script and style elements
        $('script, style').remove();

        // Extract all links
        const links: string[] = [];
        $('a[href]').each((_, element) => {
            const href = $(element).attr('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                links.push(href);
            }
        });

        // Convert main content to markdown
        const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });

        // Get the main content (focusing on body content)
        const mainContent = $('body').html() || '';
        const markdown = turndownService.turndown(mainContent);

        return {
            markdown,
            links: [...new Set(links)] // Remove duplicate links
        };
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Scraping failed: ${error.message}`);
        }
        throw new Error('An unknown error occurred while scraping');
    }
}

// Example usage:
// const result = await scrapeWebpage('https://example.com');
// console.log(result.markdown);
// console.log(result.links);
