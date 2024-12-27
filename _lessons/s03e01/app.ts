import { join } from "path";
import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway } from "../common/TaskSubmitGateway";
import fs from "fs";
import type { ParsingError } from "../common/types";
import type { ChatCompletionMessageParam, ChatCompletion } from "openai/resources/chat/completions";
import { keyWordsTextExtractorSystemMessage, keyWordsTextExtractorSystemMessage2 } from "./prompts";

const apiKey = process.env.PERSONAL_API_KEY;
const task = "dokumenty";
const endpoint = "https://centrala.ag3nts.org/report";

const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task: task, endpoint: endpoint });
const openAIService = new OpenAIService({ tracing: true });

const filesDir = join(__dirname, "files");
const factsDir = join(filesDir, "facts");

type KeywordsResponse = {
    thinking: string;
    keywords: string;
}

type Answer = {
    [key: string]: string;
}


const getSystemMessage = (factsContent: string): ChatCompletionMessageParam => {
   return keyWordsTextExtractorSystemMessage2(factsContent);
}

async function generateKeywords(reportContent: string, systemMessage: ChatCompletionMessageParam): Promise<KeywordsResponse | ParsingError> {
    // const systemMessage = {
    //     role: "system",
    //     content: "You are an expert at extracting key Polish words from security reports. Generate a comma-separated list of relevant keywords in Polish that describe the main topics, locations, and events in the report. Consider all available context from facts and other reports when generating keywords."
    // };

    const messages: ChatCompletionMessageParam[] = [
        systemMessage,
        {
            role: "user",
            content: `Report to analyze:\n${reportContent}`
        }
    ];

    // console.log('messages', JSON.stringify(messages, null, 2));

    const llmResponse = await openAIService.completion({
        messages,
        jsonMode: true,
    });

    return openAIService.parseJsonResponse<KeywordsResponse>(llmResponse as ChatCompletion);
}


async function buildContextFromFiles(dir: string): Promise<string> {
    // Load and join facts
    const files = fs.readdirSync(dir).filter(file => file.endsWith('.txt'));
    const filesContent = files.map(file => {
        const content = fs.readFileSync(join(dir, file), 'utf8');
        return `[${file}]\n${content}`;
    }).join('\n\n');
    return filesContent;
}

async function processFiles(): Promise<Answer> {
    // Load and join facts
    const factsContent = await buildContextFromFiles(factsDir);

    // Load and process reports
    const reportFiles = fs.readdirSync(filesDir)
        .filter(file => file.endsWith('.txt') && !file.includes('facts/'));
    
    const answer: Answer = {};

    const systemMessage = getSystemMessage(factsContent);

    console.log('systemMessage', JSON.stringify(systemMessage, null, 2));
    
    for (const file of reportFiles) {
        const reportContent = fs.readFileSync(join(filesDir, file), 'utf8');
        const result = await generateKeywords(`${file}\n${reportContent}`, systemMessage);

        console.log('RESULT', JSON.stringify({ file, result }, null, 2));
        
        if ('error' in result) {
            console.error(`Error processing ${file}:`, result.error);
            continue;
        }
        
        answer[file] = result.keywords;
    }

    return answer;
}

async function main() {
    try {
        const answer = await processFiles();

        const submitResponse = await taskSubmitGateway.submit<Answer>(answer, "json");
        console.log("response", JSON.stringify(submitResponse, null, 2));

        console.log("\nPress Enter to exit...");
        await new Promise(resolve => {
            process.stdin.once('data', () => {
                resolve(undefined);
            });
        });

    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

main();