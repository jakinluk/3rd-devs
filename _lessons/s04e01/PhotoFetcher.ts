import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";

export class PhotoFetcher {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async fetchPhotos(urls: string[]): Promise<string[]> {
    const downloadedFiles: string[] = [];
    
    for (const url of urls) {
      try {
        const response = await fetch(this.baseUrl + url);
        if (!response.ok) {
          console.error(`Failed to fetch ${url}: ${response.statusText}`);
          continue;
        }

        const buffer = await response.buffer();
        const fileName = path.basename(url);
        const filePath = path.join(process.cwd(), 'temp', fileName);
        
        await fs.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });
        await fs.writeFile(filePath, buffer);
        
        downloadedFiles.push(filePath);
      } catch (error) {
        console.error(`Error downloading ${url}:`, error);
      }
    }

    return downloadedFiles;
  }
} 