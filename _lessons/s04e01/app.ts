import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway } from "../common/TaskSubmitGateway";
import { PhotoFetcher } from "./PhotoFetcher";
import { planPrompt } from "./prompts/plan";
import { fetchPhotosPrompt } from "./prompts/fetch-photos";
import { fixPhotosPrompt } from "./prompts/fix-photos";
import { describePhotosPrompt } from "./prompts/describe-photos";
import { answerPrompt } from "./prompts/answer";
import { extractTagContent } from "../common/contextUtils";
import express from "express";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

const apiKey = process.env.PERSONAL_API_KEY;
const task = "photos";
const endpoint = "https://centrala.ag3nts.org/report";

const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task: task, endpoint: endpoint });
const openAIService = new OpenAIService({ tracing: true });
const photoFetcher = new PhotoFetcher("https://centrala.ag3nts.org/dane/barbara/");

interface Step {
  [key: string]: any;
}

async function executeStep(step: Step, context: string): Promise<any> {
  const [toolName] = Object.keys(step);
  const params = step[toolName];

  switch (toolName) {
    case "fetch-photos":
      const urls = await openAIService.completion({
        messages: [
          { role: "system", content: fetchPhotosPrompt },
          { role: "user", content: params }
        ],
        jsonMode: true
      });
      const urlsData = JSON.parse(urls.choices[0].message.content!);
      return await photoFetcher.fetchPhotos(urlsData.urls);

    case "fix-photos":
      const fixes = await openAIService.completion({
        messages: [
          { role: "system", content: fixPhotosPrompt },
          { role: "user", content: JSON.stringify(params) }
        ],
        jsonMode: true
      });
      // Here you would implement actual photo fixing logic
      return JSON.parse(fixes.choices[0].message.content!);

    case "describe-photos":
      const description = await openAIService.completion({
        messages: [
          { role: "system", content: describePhotosPrompt },
          { role: "user", content: JSON.stringify(params) }
        ],
        jsonMode: true
      });
      return JSON.parse(description.choices[0].message.content!);

    case "answer":
      const answer = await openAIService.completion({
        messages: [
          { role: "system", content: answerPrompt.replace("${context}", context) },
          { role: "user", content: params }
        ],
        jsonMode: true
      });
      return JSON.parse(answer.choices[0].message.content!);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

async function processPlan(query: string, context: string = ""): Promise<string> {
  const plan = await openAIService.completion({
    messages: [
      { role: "system", content: planPrompt.replace("${context}", context) },
      { role: "user", content: query }
    ],
    jsonMode: true
  });

  const { steps } = JSON.parse(plan.choices[0].message.content!);
  
  let newContext = context;
  for (const step of steps) {
    const result = await executeStep(step, newContext);
    newContext += `\n<${Object.keys(step)[0]}>${JSON.stringify(result)}</${Object.keys(step)[0]}>`;
    
    // If this was an answer step, return the result
    if (Object.keys(step)[0] === "answer") {
      return result.description;
    }
  }

  // If we haven't returned an answer yet, continue planning
  return await processPlan(query, newContext);
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

    // Submit the result if it's the final answer
    if (result.includes("Barbara")) {
      await taskSubmitGateway.submit(result);
    }

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