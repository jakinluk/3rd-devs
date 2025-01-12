import type { Itool } from "../Itool";
import { scrapeWebpage } from "../../simple-web-scraper";

interface ScrapeInput {
  url: string;
}

interface ScrapeOutput {
  markdown: string;
  links: string[];
}

export class ScrapeTool implements Itool<ScrapeInput, ScrapeOutput> {
  name = "scrape";
  description = "Scrape the website and return the markdown and links";
  inputDescription = "Absolute URL to scrape";
  outputDescription = "Markdown and links from the website";

  async process(input: ScrapeInput): Promise<ScrapeOutput> {
    let url = input.url;
    if (!url.includes("softo.ag3nts.org")) {
      url = "https://softo.ag3nts.org/" + url;
      url = url.replace("//", "/");
    }
    console.log("SCRAPING URL", url);
    return scrapeWebpage(url);
  }
}   