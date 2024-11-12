const roboServer = "https://xyz.ag3nts.org/verify";


import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";
import { OpenAIService } from "../common/OpenAIService";
import prompt from './corrupted-memory-robot';
import type OpenAI from "openai";


type RoboMessage = {
    msgID: number;
    text: string;
}

const initialMessages: RoboMessage = { msgID: 0, text: "READY" };


class RoboHttpClient {
   
    async sendMessage<T>(message: RoboMessage): Promise<T> {
        //POST message to the robot
        const response = await fetch(`${roboServer}`, {
            method: 'POST',
            body: JSON.stringify(message),
            redirect: 'follow',
        });

        return response.json();
    }
}

class FakeRobot {
    constructor(private readonly ai: OpenAIService) {}
    async answerQuestion(question: string): Promise<string | null> {
        const messages = (await prompt({ vars: { query: question }})) as ChatCompletionMessageParam[];
        const completion = (await this.ai.completion(messages)) as OpenAI.Chat.Completions.ChatCompletion;
        return completion.choices[0]?.message?.content ||  null;
    }
}

async function authorizeWithPatrolingRobot(robot: FakeRobot) {
    try {
        const httpClient = new RoboHttpClient();
        const response = await httpClient.sendMessage<RoboMessage>(initialMessages);

        const conversationId = response.msgID;

        const maxAttempts = 10;
        let attempts = 0;
        let questionToAnswer = response.text;
        do {
            console.log(`Attempt ${attempts}, question: ${questionToAnswer}`);
            const answer = await robot.answerQuestion(questionToAnswer);
            if (!answer) {
                throw new Error("No answer error");
            }
            console.log(`Answer: ${answer}`);
            const response = await httpClient.sendMessage<RoboMessage>({ msgID: conversationId, text: answer === "?" ? "questionToAnswer" : answer });
            questionToAnswer = response.text;
            attempts++;
        } while (response.text !== "OK" && attempts < maxAttempts);

        
    } catch (error) {
        console.error('Error fetching question:', error);
        throw error;
    }
}

async function main() {
    const openAIService = new OpenAIService();
    const robot = new FakeRobot(openAIService);
    
    try {
        await authorizeWithPatrolingRobot(robot);
    } catch (error) {
        console.error('Error authorizing with patroling robot:', error);
        throw error;
    }
}

main();
