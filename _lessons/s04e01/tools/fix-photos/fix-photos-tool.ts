import type { ChatCompletion } from "openai/resources/chat/completions";
import type { OpenAIService } from "../../../common/OpenAIService";
import type { Itool } from "../Itool";
import type { FixPhotosClient, ToFixSingle } from "./fix-photos-client";
import { join } from "path";
import fsSync from 'fs';
import type { FetchPhotosTool } from "../fetch-photos/fetch-photos-tool";


const fixPhotoPrompt = `You are a Photo Quality Analyzer. Your role is to examine photos and recommend necessary fixes.

<objective>
Analyze a provided photo and determine which fixes are needed to improve visibility and quality.
</objective>

<rules>
- Check photo for common issues:
  * Noise and artifacts (needs repair)
  * Too dark (needs brightening)
  * Too bright (needs darkening)
- A photo may need multiple fixes but choose the most appropriate one
- If a photo looks good, don't include it in any fix group
- If a photo is OK, include it in the "no-fix" group
- you do not want to make picture perfect, just to address significant issues. If there is no significant issues, just return "good"
- If you are not sure, return "good"
</rules>

<output_format>
{
  "_thinking": "Explanation of analysis process",
  "action": "repair" | "darken" | "brighten" | "good"
}
</output_format>
Remember, your sole function is to generate these JSON responses based on task-related conversations. Do not engage in direct responses to queries.
`;  

export type FixPhotosInput = {
  toFix: string;
}

export type FixPhotosOutput = {
  fixed: string;
}
    
const buildFileContent = (photosDir: string, file: string) => {
  const image = fsSync.readFileSync(join(photosDir, file));
  const base64Image = image.toString('base64');
  return `data:image/jpeg;base64,${base64Image}`;
}

export class FixPhotosTool implements Itool<FixPhotosInput, FixPhotosOutput> {
  name = "fix-photos";
  description = "Fetches and fixes photos.";
  inputDescription = "String with file names to be fixed separated by commas";
  outputDescription = "String with the names of the files that were fixed separated by commas";

  private openAIService: OpenAIService;
  private fixPhotosClient: FixPhotosClient;
  private fetchPhotosTool: FetchPhotosTool;
  private photosDir: string;


  constructor(openAIService: OpenAIService, fixPhotosClient: FixPhotosClient, fetchPhotosTool: FetchPhotosTool, photosDir: string) {
    this.openAIService = openAIService;
    this.fixPhotosClient = fixPhotosClient;
    this.fetchPhotosTool = fetchPhotosTool;
    this.photosDir = photosDir;
  }

  async process(input: FixPhotosInput): Promise<FixPhotosOutput> {

    const inputFiles = input.toFix.split(",").map( s => s.trim());
    console.log("Files to fix:", inputFiles);

    const fixed: string[] = [];
    const maxIterations = 5;
    let iteration = 0;
    let filesToFix = inputFiles;
    const baseUrl = "https://centrala.ag3nts.org/dane/barbara/";
    while (filesToFix.length > 0 && iteration < maxIterations) {

      const newToFetch: string[] = [];

      for (const file of filesToFix) {
        if(fixed.includes(file)) {
          console.log("Already fixed:", file);
          continue;
        }
        console.log("Searching for fixes for:", file);
        const toFix = await this.openAIService.completion({
            messages: [
            { role: "system", content: fixPhotoPrompt },
            { role: "user", content: [
              { type: "text", text: "Fix the attached photos" },
              { type: "image_url", image_url: { url: buildFileContent(this.photosDir, file) } },
            ] }
          ],
          jsonMode: true
        });
        const toFixSingle = this.openAIService.parseJsonResponse<ToFixSingle>(toFix as ChatCompletion);
        if (toFixSingle.action === "good") {
          fixed.push(file);
          continue;
        }
        const fixPhotoClientResponse = await this.fixPhotosClient.applyFix({ filename: file, action: toFixSingle.action });
        const { fetchedFiles } = await this.fetchPhotosTool.process({ query: fixPhotoClientResponse + ". Base url: " + `${baseUrl}` });
        if (fetchedFiles.length > 0) {
          newToFetch.push(...fetchedFiles);
        } else {
          console.log("Dead end, assuming it's fixed. Fix tool response on the last fix attempt:", fixPhotoClientResponse);
          fixed.push(file);
        }
      }
      filesToFix = newToFetch;
      iteration++;
    }
    return { fixed: fixed.join(",") };
    
  }
  
}