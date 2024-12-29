import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway } from "../common/TaskSubmitGateway";
import type { ChatCompletion, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { DBGateway } from "./DBGateway";
import { sqlQueryBuilderPrompt } from "./prompts";
import type { ParsingError } from "../common/types";

const apiKey = process.env.PERSONAL_API_KEY;
const task = "database";
const endpoint = "https://centrala.ag3nts.org/report";
const query = "Które aktywne datacenter (DC_ID) są zarządzane przez pracowników, którzy są na urlopie (is_active=0)?";

const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task: task, endpoint: endpoint });
const openAIService = new OpenAIService({ tracing: true });
const dbGateway = new DBGateway({ apiKey: apiKey!, task: task, endpoint: "https://centrala.ag3nts.org/apidb" });

async function buildDatabaseContext(): Promise<string> {
    // Get tables list
    const response = await dbGateway.query("show tables");
    
    // Get schema for each table
    const schemaPromises = response.reply.map(async (table: any) => {
        const tableName = Object.values(table)[0];
        console.log(`Getting schema for ${tableName}`);
        const schema = await dbGateway.query(`show create table ${tableName}`);
        return schema.reply[0]["Create Table"];
    });
    
    const schemas = await Promise.all(schemaPromises);
    return schemas.join("\n\n");
}

async function main() {
    try {
        // 1. Build database context
        const context = await buildDatabaseContext();

        // 2. Get SQL query from OpenAI
        const messages: ChatCompletionMessageParam[] = [
            sqlQueryBuilderPrompt(context),
            { role: 'user', content: query }
        ];

        console.log('Messages:', messages);
        
        const sqlResponse = await openAIService.completion({
            messages,
            model: 'gpt-4o',
            jsonMode: true
        }) as ChatCompletion;
        const sqlResult = openAIService.parseJsonResponse<{thinking: string, sqlQuery: string}>(sqlResponse);
        if ((sqlResult as ParsingError).error) {
            throw new Error((sqlResult as ParsingError).error);
        }

        console.log('Final SQL query:', JSON.stringify(sqlResult));

        // 3. Execute the SQL query
        const queryResult = await dbGateway.query((sqlResult as {thinking: string, sqlQuery: string}).sqlQuery);

        console.log('Final query result:', JSON.stringify(queryResult));

        // 4. Format the answer
        const answer = queryResult.reply.map((row: any) => row.dc_id);
        // 5. Submit the answer
        const result = await taskSubmitGateway.submit<any>(answer, "json");

        console.log('Result:', result);
        
    } catch (error) {
        console.error('Error', error);
        throw error;
    }
}

main();