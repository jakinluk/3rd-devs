import { scrapeWebpage } from './simple-web-scraper';
import { writeFileSync } from 'fs';

async function main() {
    // You can change this URL for testing
    const targetUrl = 'https://softo.ag3nts.org/';

    try {
        console.log(`🔍 Scraping ${targetUrl}...`);
        const result = await scrapeWebpage(targetUrl);

        console.log('\n📝 Markdown Content:');
        console.log('-------------------');
        console.log(result.markdown);

        console.log('\n🔗 Found Links:');
        console.log('-------------');
        result.links.forEach(link => console.log(`- ${link}`));

        // Optionally save results to files
        writeFileSync('content.md', result.markdown);
        writeFileSync('links.json', JSON.stringify(result.links, null, 2));

        console.log('\n✅ Results saved to content.md and links.json');
    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error occurred');
        process.exit(1);
    }
}

main();
