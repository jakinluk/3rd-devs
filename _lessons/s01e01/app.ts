const url = "xyz.ag3nts.org";
const username = "tester";
const password = "574e112a";
import type { ChatCompletion, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { OpenAIService } from "../common/OpenAIService";
import * as cheerio from 'cheerio';
import prompt from './concise-response-prompt';
import type OpenAI from "openai";

async function getHumanQuestion() {
    try {
        // Fetch the webpage content
        const response = await fetch(`https://${url}`);
        const html = await response.text();

        // Parse HTML using cheerio
        const $ = cheerio.load(html);
        
        // Get the paragraph content using cheerio selector
        const questionElement = $('#human-question');
        if (questionElement.length === 0) {
            throw new Error('Question element not found');
        }

        return questionElement.text();
    } catch (error) {
        console.error('Error fetching question:', error);
        throw error;
    }
}

async function getAIResponse(question: string) {
    const openAIService = new OpenAIService();
    
    const messages = (await prompt({ vars: { query: question }})) as ChatCompletionMessageParam[];
    try {
        const completion = (await openAIService.completion({messages, model: "gpt-4o"})) as ChatCompletion;
        return completion.choices[0]?.message?.content || 'No response received';
    } catch (error) {
        console.error('Error getting AI response:', error);
        throw error;
    }
}

async function submitForm(answer: number) {
    try {
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('answer', answer.toString());

        // Submit the form
        const formResponse = await fetch(`https://${url}`, {
            method: 'POST',
            body: formData,
            redirect: 'follow',
        });

        // Get the content of the target page
        const targetPageHtml = await formResponse.text();
        
        // Parse and return the content
        const $ = cheerio.load(targetPageHtml);
        return {
            status: formResponse.status,
            url: formResponse.url,
            content: $('body').text().trim()
        };
    } catch (error) {
        console.error('Error submitting form:', error);
        throw error;
    }
}

async function main() {
    try {
        // Get the question from the webpage
        const question = await getHumanQuestion();
        console.log('Human question:', question);

        // Get AI response
        if (question) {
            const aiResponse = await getAIResponse(question);
            console.log('AI response:', aiResponse);
            
            // Parse the answer as a number
            const answer = parseInt(aiResponse.replace(/\D/g, ''), 10);
            console.log('Submitting answer:', answer);

            // Submit the form and get the target page content
            const result = await submitForm(answer);
            
            console.log('Redirected to:', result.url);
            console.log('Target page content:', result.content);
        }
        
    } catch (error) {
        console.error('Failed to process:', error);
    }
}

main();


// <form method="post" action="/">
//     <input class="form-control" type="text" name="username" placeholder="Login" required="">
//     <input class="form-control" type="password" name="password" placeholder="Password" required="">
//     <p>Prove that you are not human</p>
//     <p id="human-question">Question:<br>Rok zrzucenia bomby na Hiroszimę?</p>
//     <input class="form-control" type="number" name="answer" placeholder="Answer" required="">
//     <div class="form-button d-flex align-items-center">
//         <button id="submit" type="submit" class="btn btn-primary">Login</button><a href="forget.php">Forget password?</a>
//     </div>
// </form>

// $ bun _lessons/s01e01/app.ts
// Human question: Question:Rok zrzucenia bomby na Hiroszimę?
// AI response: 1945
// Submitting answer: 1945
// Redirected to: https://xyz.ag3nts.org/firmware
// Target page content: Download section
//                         Download the latest software for your zone patrolling robot.
                        
//                         Version 0.13.4b
//                         - robot no longer kills people- some other stability improvements
//                         Version 0.13.4
//                         - security improvements

//                         Version 0.12.1
//                         - added some extra security
                        
//                         {{FLG:FIRMWARE}}