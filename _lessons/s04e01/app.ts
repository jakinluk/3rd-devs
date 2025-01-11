import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway } from "../common/TaskSubmitGateway";
import { PhotoFetcher } from "./PhotoFetcher";
import { planPrompt } from "./prompts/plan";
import { fetchPhotosPrompt } from "./prompts/fetch-photos";
import { fixPhotosPrompt } from "./prompts/fix-photos";
import { describePhotosPrompt } from "./prompts/describe-photos";
import { answerPrompt } from "./prompts/answer";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { PhotoFix, type ToFix } from "./PhotoFix";
import type { ChatCompletion, ChatCompletionContentPart, ChatCompletionContentPartImage, ChatCompletionContentPartText } from "openai/resources/chat/completions.mjs";
import fs from 'fs/promises';
import fsSync from 'fs';
import { join } from "path";

const app = express();
app.use(express.json());

const apiKey = process.env.PERSONAL_API_KEY;
const task = "photos";
const endpoint = "https://centrala.ag3nts.org/report";

const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task: task, endpoint: endpoint });
const openAIService = new OpenAIService({ tracing: true });
const photosDir = join(__dirname, "temp");
const photoFetcher = new PhotoFetcher(photosDir);
const photoFix = new PhotoFix();


interface Step {
  [key: string]: any;
}

interface PhotoUrls {
//   _thinking: string;
  urls: string[];
}

interface PhotoDescription {
//   _thinking: string;
  photos: Record<string, string>;
}

interface Answer {
//   _thinking: string;
  answer: string;
}

async function executeStep(step: Step, context: string): Promise<Record<string, any>> {
  const [toolName] = Object.keys(step);
  const params = step[toolName];

  switch (toolName) {
    case "fetch-photos": {
      const urls = await openAIService.completion({
        messages: [
          { role: "system", content: fetchPhotosPrompt },
          { role: "user", content: params as string }
        ],
        jsonMode: true
      });
      const urlsData = openAIService.parseJsonResponse<PhotoUrls>(urls as ChatCompletion);
      return await photoFetcher.fetchPhotos(urlsData.urls);
    }

    case "fix-photos": {
      const filesToFix = (params as string).split(",").map( s => s.trim());

      const buildFileContent = (file: string) => {
        const image = fsSync.readFileSync(join(photosDir, file));
        const base64Image = image.toString('base64');
        return `data:image/jpeg;base64,${base64Image}`;
      }

      const imageUrls: Array<ChatCompletionContentPartImage> = filesToFix.map(file => ({ type: "image_url", image_url: { url: buildFileContent(file) } }));

      const fixes = await openAIService.completion({
        messages: [
            { role: "system", content: fixPhotosPrompt },
            { 
                role: "user",
                content: [
                    // { type: "image_url", image_url: { url: `data:image/jpeg;base64,` } },
                    imageUrls,
                ] as unknown as Array<ChatCompletionContentPart>
            }
        ],
        jsonMode: true
      });
      const fixResult = openAIService.parseJsonResponse<ToFix>(fixes as ChatCompletion);
      const fixedPhotos = await photoFix.applyFixes(fixResult);
      return { beforeFixAnalysis: fixResult, fixResults: fixedPhotos };
    }

    case "describe-photos": {
      const filesToFix = (params as { photos: string, hint: string }).photos.split(",").map( s => s.trim());
      const hint = (params as { photos: string, hint: string }).hint;

      const buildFileContent = (file: string) => {
        const image = fsSync.readFileSync(join(photosDir, file));
        const base64Image = image.toString('base64');
        return `data:image/jpeg;base64,${base64Image}`;
      }

      const imageUrls: Array<ChatCompletionContentPartImage> = filesToFix.map(file => ({ type: "image_url", image_url: { url: buildFileContent(file) } }));

      const description = await openAIService.completion({
        messages: [
          { role: "system", content: describePhotosPrompt() },
          { role: "user", content: [
            { type: "text", text: hint },
            imageUrls,
          ] as unknown as Array<ChatCompletionContentPart> }
        ],
        jsonMode: true
      });
      return openAIService.parseJsonResponse<PhotoDescription>(description as ChatCompletion);
    }

    case "answer": {
      const answer = await openAIService.completion({
        messages: [
          { role: "system", content: answerPrompt(context) },
          { role: "user", content: params }
        ],
        jsonMode: true
      });
      return openAIService.parseJsonResponse<Answer>(answer as ChatCompletion);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

function buildStepContext(step: Step, result: any): string {
  const stepName = Object.keys(step)[0];
  return `\n<${stepName}>\n<params>${step[stepName]}</params>\n<result>${JSON.stringify(result)}</result>\n</${stepName}>`;
}

async function processPlan(query: string, context: string = "", iteration: number = 1): Promise<string> {
  const plan = await openAIService.completion({
    messages: [
      { role: "system", content: planPrompt(context) },
      { role: "user", content: query }
    ],
    jsonMode: true
  });

  const {steps} = openAIService.parseJsonResponse<{ steps: Step[] }>(plan as ChatCompletion);
  
  let newContext = context;
  for (const step of steps) {
    const result = await executeStep(step, newContext);
    newContext += buildStepContext(step, result);
    
    if (Object.keys(step)[0] === "answer") {
      return result.answer;
    }
  }

  if (iteration >= 10) {
    return "I'm sorry, I couldn't find the answer to your question.";
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // If we haven't returned an answer yet, continue planning
  return await processPlan(query, newContext, iteration + 1);
}

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, conversation_id = uuidv4() } = req.body;
    
    // Get the last user message
    const lastMessage = messages.filter((m: any) => m.role === "user").pop();
    if (!lastMessage) {
      return res.status(400).json({ error: "No user message found" });
    }

    // Process the message
    const result = await processPlan(lastMessage.content);

    // Return the response
    return res.json({
      conversation_id,
      response: result
    });

  } catch (error) {
    console.error("Error processing chat:", error);
    return res.status(500).json({ 
      error: "An error occurred while processing your request",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});