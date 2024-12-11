import type OpenAI from "openai";
import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway, type SubmitPayload } from "../common/TaskSubmitGateway";
import { promises as fs } from 'fs';
import path from 'path';

const apiKey = process.env.PERSONAL_API_KEY;
const task = "JSON";
const endpoint = "https://centrala.ag3nts.org/report";

const taskSubmitGateway = new TaskSubmitGateway({apiKey: apiKey!, task: task, endpoint: endpoint});  
const openAIService = new OpenAIService({tracing: true});
const prompt = `You are the helpful assistant. You are given a general knowledge question and you need to answer it.`;


async function getTestAnswer(question: string, answer: string): Promise<string | null> {
    const llmResponse = (await openAIService.completion({ messages:[
                {
                    "role": "system",   
                    "content": prompt
                },
                {
                    "role": "user",
                    "content": question
                }
            ],
            jsonMode: true
        })) as OpenAI.Chat.Completions.ChatCompletion;

    return llmResponse.choices[0]?.message?.content || null;
}

async function main() {
    try {
        // Read and parse JSON file
        const jsonPath = path.join(process.cwd(), '_lessons', 's01e03', 'json.txt');
        const jsonContent = await fs.readFile(jsonPath, 'utf-8');
        const data = JSON.parse(jsonContent);

        // Process test-data array
        if (data['test-data'] && Array.isArray(data['test-data'])) {
            // data['test-data'] = data['test-data'].map(async item => {
            data['test-data'] = await Promise.all(data['test-data'].map(async item => {
                if (item.question && item.answer !== undefined) {
                    // Extract numbers from question
                    const numbers = item.question.split('+').map((n: string) => parseInt(n.trim()));
                    // console.log(numbers);
                    if (numbers.length === 2) {
                        // Calculate correct answer
                        const correctAnswer = numbers[0] + numbers[1];
                        let test = item.test;
                        if(test) {
                            test.a = await getTestAnswer(test.q, correctAnswer);
                        }
                        return {
                            ...item,
                            answer: `${correctAnswer}`,
                            test
                        };
                    }
                }
                return item;
            }));
            // console.log(JSON.stringify(data['test-data'], null, 4));
        }

        data["apikey"] = apiKey!;

        // Write corrected data back to new file with updated- prefix
        await fs.writeFile(path.join(process.cwd(), '_lessons', 's01e03', 'json_updated.txt'), JSON.stringify(data, null, 4), 'utf-8');

        // Submit the task
        const submitResponse = await taskSubmitGateway.submit<any>(data, "json");

        // console.log(submitResponse);

        // Wait for user input before exiting
        console.log("\nPress Enter to exit...");
        await new Promise(resolve => {
            process.stdin.once('data', () => {
                resolve(undefined);
            });
        });

    } catch (error) {
        console.error('Error processing JSON file:', error);
        throw error;
    }
}

main();


