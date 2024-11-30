import type OpenAI from "openai";
import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway, type SubmitPayload } from "../common/TaskSubmitGateway";
import { LangfuseService } from "../common/LangfuseService";
import type { ChatCompletionMessageParam } from "ai/prompts";
import fs from "fs";
import { join } from "path";
import { ocrTextExtractionSystemMessage } from "./prompts";
import type { ChatCompletion } from "openai/resources/chat/completions.mjs";
import type { ParsingError } from "../common/types";

const apiKey = process.env.PERSONAL_API_KEY;
const task = "kategorie";
const endpoint = "https://centrala.ag3nts.org/report";

const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task: task, endpoint: endpoint });
const openAIService = new OpenAIService({ tracing: true });
const langfuseService = new LangfuseService();

const filesDir = join(__dirname, "files");

type LLMResponse = {
    thinking: string;
    answer: "people" | "hardware" | "other";
}

async function isAboutPeopleOrHardware(text: string): Promise<LLMResponse | ParsingError> {
    const prompt = await langfuseService.getPrompt('IsAboutPeopleOrHardware', 2);
    const [systemMessage] = prompt.compile() as unknown as ChatCompletionMessageParam[];

    const llmResponse = (await openAIService.completion({
        messages: [
            systemMessage,
            {
                "role": "user",
                "content": text
            }
        ],
        jsonMode: true,
    })) as OpenAI.Chat.Completions.ChatCompletion;
    // return llmResponse.choices[0]?.message?.content || null;
    return openAIService.parseJsonResponse<LLMResponse>(llmResponse) as LLMResponse | ParsingError;
}

async function extractTextFromImage(image: Buffer): Promise<string> {
    const userMessage: ChatCompletionMessageParam = {
        role: 'user',
        content: [
            {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}` }
            },
            {
                type: "text",
                text: `Extract text from the provided image.`
            }
        ]
    };

    const response = await openAIService.completion({ messages: [ocrTextExtractionSystemMessage, userMessage], model: 'gpt-4o', jsonMode: false }) as ChatCompletion;
    return response.choices[0].message.content || '';
}

async function processFiles(files: string[]): Promise<Answer> {
    //use OpenAIService to  and then use executePromptOnText
    const answer: Answer = {
        people: [],
        hardware: []
    };
    for (const file of files) {
        const extension = file.split('.').pop() as string;
        let text = null;
        if (extension === 'png') {
            text = await extractTextFromImage(fs.readFileSync(join(filesDir, file)));
        } else if (extension === 'mp3') {
            text = await openAIService.transcribe(fs.readFileSync(join(filesDir, file)));
        } else if (extension === 'txt') {
            text = fs.readFileSync(join(filesDir, file), 'utf8');
        }

        if (text) {
            const result = await isAboutPeopleOrHardware(text);
            console.log('RESULT', JSON.stringify({ text, result }, null, 2));
            //check if result is ParsingError
            if ('error' in result) {
                console.error("Error parsing JSON response:", result.error);
                continue;
            }

            if (result.answer === "people") {
                answer.people.push(file);
            } else if (result.answer === "hardware") {
                answer.hardware.push(file);
            }
        }
    }
    return answer;
}

type Answer = {
    people: string[];
    hardware: string[];
}

async function main() {
    try {
        const files = fs.readdirSync(filesDir);
        console.log(files);

        const answer = await processFiles(files);

        console.log('answer', JSON.stringify(answer, null, 2));

        // const answer = {
        //     "people": [
        //         "2024-11-12_report-00-sektor_C4.txt",
        //         "2024-11-12_report-07-sektor_C4.txt",
        //       "2024-11-12_report-10-sektor-C1.mp3"
        //     ],
        //     "hardware": [
        //         "2024-11-12_report-13.png",
        //         "2024-11-12_report-15.png",
        //         "2024-11-12_report-17.png"
        //     ]
        // };

        // Submit the task
        const submitResponse = await taskSubmitGateway.submit<Answer>({
            task: task,
            apikey: apiKey!,
            answer: answer,
        }, "text");

        console.log("response", submitResponse);
        console.log("response", JSON.stringify(submitResponse, null, 2));

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


