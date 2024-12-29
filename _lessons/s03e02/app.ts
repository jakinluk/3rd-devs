import { join } from "path";
import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway } from "../common/TaskSubmitGateway";
import fs from "fs";
import type { ParsingError } from "../common/types";
import type { ChatCompletionMessageParam, ChatCompletion } from "openai/resources/chat/completions";
import { prompt } from "./prompts";
import { QdrantVectorService } from "../common/QdrantVectorService";
import { v4 as uuidv4 } from "uuid";


const apiKey = process.env.PERSONAL_API_KEY;
const task = "wektory";
const endpoint = "https://centrala.ag3nts.org/report";
const query = "W raporcie, z którego dnia znajduje się wzmianka o kradzieży prototypu broni?";

const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task: task, endpoint: endpoint });
const openAIService = new OpenAIService({ tracing: true });
const vectorService = new QdrantVectorService(openAIService);

const filesDir = join(__dirname, "files");


const checkSearchResultRelevance = async (query: string, searchResult: string) => {
    const relevanceCheck = await openAIService.completion({
        messages: [
            { role: 'system', content: 'You are a helpful assistant that determines if a given text is relevant to a query. Respond with 1 if relevant, 0 if not relevant.' },
            { role: 'user', content: `Query: ${query}\nText: ${searchResult}` }
        ],
        model: 'gpt-4o'
    }) as ChatCompletion;
    const isRelevant = relevanceCheck.choices[0].message.content === '1';
    return isRelevant;
}

const ragAnswer = async (query: string, context: string): Promise<{thinking: string, answer: string}> => {
    const answer = await openAIService.completion({
        messages: [
            // { role: 'system', content: 'You are a helpful assistant that answers questions in the requested format based on the provided context.\n<response_format>YYYY-MM-DD</response_format>\n\n<context>\n${context}\n</context>' }, 
            prompt(context),
            { role: 'user', content: `Query: ${query}` }
        ],
        model: 'gpt-4o',
        jsonMode: true
    }) as ChatCompletion;
    if (!answer.choices[0].message.content) {
        throw new Error('No answer received');
    }
    return JSON.parse(answer.choices[0].message.content) as {thinking: string, answer: string};
}

async function main() {
    try {
        // 1. Read and process all files
        const files = fs.readdirSync(filesDir);
        
        // 2. Prepare points for indexing
        const points = files.filter(file => file.endsWith('.txt')).map(file => {
            const filePath = join(filesDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const title = content.split('\n')[0].trim();
            
            // Extract date from filename (assuming format: 2024_07_05.txt)
            const reportDate = file.split('.')[0].split('_').join('-');
            
            return {
                text: content,
                metadata: {
                    title,
                    source: filePath,
                    uuid: uuidv4(),
                    report_date: reportDate
                }
            };
        });

        // 3. Initialize collection with documents
        console.log(`Initializing collection with points`);
        await vectorService.initializeCollectionWithData('aidevs', points);

        // 4. Search for the theft mention
        const searchResults = await vectorService.performSearch<{ text: string, report_date: string, title: string }>(
            'aidevs',
            query,
            3
        );

        // 5. Check relevance and find most relevant document
        const relevantResults = await Promise.all(searchResults.map(async (result) => {
            if (!result.payload) {
                return { ...result, isRelevant: false };
            }
            const isRelevant = await checkSearchResultRelevance(query, result.payload.text as string);
            return { ...result, isRelevant };
        }));

        console.log('Relevant results:', JSON.stringify(relevantResults, null, 2));

        // build context from the relevant documents
        const context = relevantResults.filter(result => result.isRelevant).map(result => `Report date: ${result.payload.report_date}\n#${result.payload.title}\n${result.payload.text}`).join('\n\n');

        console.log(`Context: \n${context}`);

        const answer = await ragAnswer(query, context);

        console.log('Answer:', JSON.stringify(answer, null, 2));

        if (!answer) {
            throw new Error('Could not find relevant document mentioning the theft');
        }

        // 6. Submit the answer
        const result = await taskSubmitGateway.submit<string>(answer.answer, "text");

        console.log('Result:', result);
        
    } catch (error) {
        console.error('Error', error);
        throw error;
    }
}

main();