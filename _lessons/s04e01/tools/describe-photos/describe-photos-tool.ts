import type { ChatCompletion, ChatCompletionContentPartImage } from "openai/resources/chat/completions";

import type { ChatCompletionContentPart } from "openai/resources/chat/completions.mjs";
import type { OpenAIService } from "../../../common/OpenAIService";
import type { Itool } from "../Itool";
import fsSync from 'fs';
import { join } from "path";

const describePhotosPrompt = () => `You are a Universal Photo Content Analyzer.

<objective>
Analyze the photos and describe what you found in the context of user query.
</objective>

<rules>
- respond in JSON format
- respond in English
- use output format below
</rules>

<output_format>
{
  "_thinking": "describing what you found on each photo",
  "photos": {
    "photo_file_name_1": "description of what you found on this photo in the context of what you are looking for",
    "photo_file_name_2": "description of what you found on this photo in the context of what you are looking for",
  }
}
</output_format>
Remember, your sole function is to generate these JSON responses based on task-related conversations. Do not engage in direct responses to queries.
`;

export type DescribePhotosInput = {
    photos: string;
    hint: string;
}

export type DescribePhotosOutput = {
    photos: {
        [key: string]: string;
    }
}

export class DescribePhotosTool implements Itool<DescribePhotosInput, DescribePhotosOutput> {
    name = "describe-photos";
    description = "Describe photos based on a hint";
    inputDescription = `A JSON object with the \`photos\` property containing a comma-separated list of file names of the photos to describe and a \`hint\` property containing a hint what to look for in the photos.
    Example:
    \`\`\`json
    {
        "photos": "IMG_001.jpg, IMG_002.jpg",
        "hint": "Look for a woman in the photos. Need to have a comprehensive description of the woman."
    }
    \`\`\`
    `;
    outputDescription = `A JSON object with the \`photos\` property containing a map with the file names as keys and the descriptions as values.
    Example:
    \`\`\`json
    {
        "photos": {
            "IMG_001.jpg": "We see a woman in the photo. She is wearing a red dress and has long brown hair. With tattoos on her left arm.",
            "IMG_002.jpg": "We see a woman in the photo. She is wearing a blue dress and has short blond hair."
        }
    }
    \`\`\`
    `;

    private openAIService: OpenAIService;
    private photosDir: string;
    constructor(openAIService: OpenAIService, photosDir: string) {
        this.openAIService = openAIService;
        this.photosDir = photosDir;
    }

    async process(input: DescribePhotosInput): Promise<DescribePhotosOutput> {
        const photosToDescribe = input.photos.split(",").map( s => s.trim());
        const hint = input.hint;

      const buildFileContent = (file: string) => {
        const image = fsSync.readFileSync(join(this.photosDir, file));
        const base64Image = image.toString('base64');
        return `data:image/jpeg;base64,${base64Image}`;
      }

      const imageUrls: Array<ChatCompletionContentPartImage> = photosToDescribe.map(file => ({ type: "image_url", image_url: { url: buildFileContent(file) } }));

      const description = await this.openAIService.completion({
        messages: [
          { role: "system", content: describePhotosPrompt() },
          { role: "user", content: [
            { type: "text", text: hint },
            ...imageUrls,
          ] as unknown as Array<ChatCompletionContentPart> }
        ],
        jsonMode: true
      });
      return this.openAIService.parseJsonResponse<DescribePhotosOutput>(description as ChatCompletion);
    }
}