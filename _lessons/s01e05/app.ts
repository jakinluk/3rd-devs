import type OpenAI from "openai";
import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway, type SubmitPayload } from "../common/TaskSubmitGateway";
import { LangfuseService } from "../common/LangfuseService";
import type { ChatCompletionMessageParam } from "ai/prompts";


const apiKey = process.env.PERSONAL_API_KEY;
const task = "CENZURA";
const endpoint = "https://centrala.ag3nts.org/report";
const taskDataEndpoint = `https://centrala.ag3nts.org/data/${apiKey}/cenzura.txt`;

const taskSubmitGateway = new TaskSubmitGateway({apiKey: apiKey!, task: task, endpoint: endpoint});  
const openAIService = new OpenAIService({tracing: true});
const langfuseService = new LangfuseService();


async function getTestAnswer(text: string): Promise<string | null> {
    const prompt = await langfuseService.getPrompt('Censor', 1);
    const [systemMessage] = prompt.compile() as unknown as ChatCompletionMessageParam[];

    const llmResponse = (await openAIService.completion({ messages:[
                systemMessage,
                {
                    "role": "user",
                    "content": text
                }
            ],
            jsonMode: false,
        })) as OpenAI.Chat.Completions.ChatCompletion;
    return llmResponse.choices[0]?.message?.content || null;
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
        const answer = await getTestAnswer(data);
        if (!answer) {
            throw new Error("No data returned from LLM");
        }
        console.log(answer);
        // Submit the task
        const submitResponse = await taskSubmitGateway.submit<string>({
            task: task,
            apikey: apiKey!,
            answer: answer,
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


