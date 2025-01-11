import type { ChatCompletion } from "openai/resources/chat/completions";
import type { OpenAIService } from "../../../common/OpenAIService";
import type { Itool } from "./../Itool";
import type { PhotoFetcher } from "./photo-fetcher";

const fetchPhotosPrompt = `You are a Photo URL Extractor. Your role is to analyze text and extract photo URLs or filenames that need to be downloaded.

<objective>
Determine all photo URLs mentioned in the text and create a list for downloading. If no photo URLs or filenames are mentioned, return an empty array.
</objective>

<rules>
- Respond in JSON format
- Include file extensions (.jpg, .png, etc.)
- Remove any duplicates
- Verify that extracted items look like valid photo files
- If a base URL is provided, combine it with filenames
</rules>

<output_format>
{
  "_thinking": "Explanation of URL extraction process",
  "urls": ["array of URLs with photo to fetch"]
}
</output_format>
Remember, your sole function is to generate these JSON responses based on task-related conversations. Do not engage in direct responses to queries.
`; 

export type FetchPhotosInput = {
  query: string;
}

export type FetchPhotosOutput = {
  fetchedFiles: string[];
  baseUrl: string;
}

// internal type for LLM response
interface PhotoUrls {
    urls: string[];
}
    

export class FetchPhotosTool implements Itool<FetchPhotosInput, FetchPhotosOutput> {
  name = "fetch-photos";
  description = "Fetches photos from the internet";
  inputDescription = "Natural language query describing what photos to fetch";
  outputDescription = "A JSON array with the file names of the fetched photos. May be empty if no photo names or URLs are provided.";

  private openAIService: OpenAIService;
  private photoFetcher: PhotoFetcher;

  constructor(openAIService: OpenAIService, photoFetcher: PhotoFetcher) {
    this.openAIService = openAIService;
    this.photoFetcher = photoFetcher;
  }

  async process(input: FetchPhotosInput): Promise<FetchPhotosOutput> {

    const urls = await this.openAIService.completion({
        messages: [
          { role: "system", content: fetchPhotosPrompt },
          { role: "user", content: input.query }
        ],
        jsonMode: true
      });
    const urlsData = this.openAIService.parseJsonResponse<PhotoUrls>(urls as ChatCompletion);
    const fetchedFiles = await this.photoFetcher.fetchPhotos(urlsData.urls);
    if (fetchedFiles.length === 0) {
      return { fetchedFiles: [], baseUrl: "" };
    }
    const baseUrl = urlsData.urls[0].split("/").slice(0, -1).join("/");
    return { fetchedFiles, baseUrl };
  }
  
}