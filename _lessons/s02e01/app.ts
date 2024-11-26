import { TaskSubmitGateway, type SubmitPayload } from "../common/TaskSubmitGateway";


const apiKey = process.env.PERSONAL_API_KEY;
const task = "mp3";
const endpoint = "https://centrala.ag3nts.org/report";

const taskSubmitGateway = new TaskSubmitGateway({apiKey: apiKey!, task: task, endpoint: endpoint});  


async function main() {
    try {

        const response = "Ulica prof. Stanisława Łojasiewicza"

        // Submit the task
        const submitResponse = await taskSubmitGateway.submit<string>({
            task: task,
            apikey: apiKey!,
            answer: response,
        }, "json");

        console.log(submitResponse);

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


