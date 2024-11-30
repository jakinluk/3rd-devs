import type OpenAI from "openai";
import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway, type SubmitPayload } from "../common/TaskSubmitGateway";
import { LangfuseService } from "../common/LangfuseService";
import type { ChatCompletionMessageParam } from "ai/prompts";


const apiKey = process.env.PERSONAL_API_KEY;
const task = "robotid";
const endpoint = "https://centrala.ag3nts.org/report";
const taskDataEndpoint = `https://centrala.ag3nts.org/data/${apiKey}/robotid.json`;

const taskSubmitGateway = new TaskSubmitGateway({apiKey: apiKey!, task: task, endpoint: endpoint});  
const openAIService = new OpenAIService({tracing: true});
const langfuseService = new LangfuseService();

async function getDallE3MetaPrompt(robotDescription: string): Promise<string | null> {
    const prompt = await langfuseService.getPrompt('Dalle3MetaPrompt', 1);
    const [systemMessage] = prompt.compile() as unknown as ChatCompletionMessageParam[];

    const llmResponse = (await openAIService.completion({ messages:[
                systemMessage,
                {
                    "role": "user",
                    "content": robotDescription
                }
            ],
            jsonMode: false,
        })) as OpenAI.Chat.Completions.ChatCompletion;
    return llmResponse.choices[0]?.message?.content || null;
}

async function genImage(robotDescription: string): Promise<string | null> {
    const prompt = await getDallE3MetaPrompt(robotDescription);
    if (!prompt) {
        throw new Error("No prompt returned from LLM");
    }
    console.log("dalle3 meta prompt: ", prompt);

    const llmResponse = (await openAIService.generateImage({ prompt: prompt, model: "dall-e-3" })) as OpenAI.Images.Image[];
    return llmResponse[0]?.url || null;
}

async function main() {
    try {

        //get data from endpoint with fetch
        const response = await fetch(taskDataEndpoint);
        const data = await response.text();
        if (!data) {
            throw new Error("No data returned from endpoint");
        }
        console.log(data);
        const imageUrl = await genImage(data);
        if (!imageUrl) {
            throw new Error("No data returned from LLM");
        }
        console.log("image url: ", imageUrl);
        // Submit the task
        const submitResponse = await taskSubmitGateway.submit<string>({
            task: task,
            apikey: apiKey!,
            answer: imageUrl,
        }, "text");

        console.log(submitResponse);

        // Wait for user input before exiting
        console.log("\nPress Enter to exit...");
        await new Promise(resolve => {
            process.stdin.once('data', () => {
                resolve(undefined);
            });
        });

    } catch (error) {
        console.error('Error', error);
        throw error;
    }
}

main();


