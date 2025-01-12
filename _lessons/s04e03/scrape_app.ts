import express from 'express';
import { scrapeWebpage } from './simple-web-scraper';

const app = express();
const port = 3000;

app.get('/scrape', async (req, res) => {
    const url = req.query.url as string;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        console.log(`🔍 Scraping ${url}...`);
        const result = await scrapeWebpage(url);
        
        res.json({
            url,
            ...result
        });
    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ 
            error: error instanceof Error ? error.message : 'Unknown error occurred' 
        });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`📝 Try: http://localhost:${port}/scrape?url=https://example.com`);
}); 