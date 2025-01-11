import fetch from "node-fetch";
import fs from "fs/promises";
import path from "path";


const allowedBaseUrl = "https://centrala.ag3nts.org/";

export class PhotoFetcher {
  private filesDir: string;

  constructor(filesDir: string) {
    this.filesDir = filesDir;
  }

  async fetchPhotos(urls: string[]): Promise<string[]> {
    const downloadedFiles: string[] = [];
    
    for (const url of urls) {
      try {
        if (!url.startsWith(allowedBaseUrl)) {
          console.error(`Base URL ${url} is not allowed`);
          continue;
        }

        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Failed to fetch ${url}: ${response.statusText}`);
          continue;
        }

        const buffer = await response.buffer();
        const fileName = path.basename(url);
        const filePath = path.join(this.filesDir, fileName);
        
        await fs.mkdir(this.filesDir, { recursive: true });
        await fs.writeFile(filePath, buffer);
        
        downloadedFiles.push(filePath);
      } catch (error) {
        console.error(`Error downloading ${url}:`, error);
      }
    }

    return downloadedFiles;
  }
} 