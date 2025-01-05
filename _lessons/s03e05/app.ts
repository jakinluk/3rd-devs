import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway } from "../common/TaskSubmitGateway";
import { DBGateway, type DBResponse } from "./DBGateway";
import { Neo4jService } from "../common/Neo4jService";

const apiKey = process.env.PERSONAL_API_KEY;
const task = "connections";
const endpoint = "https://centrala.ag3nts.org/report";

const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task: task, endpoint: endpoint });
const openAIService = new OpenAIService({ tracing: true });
const dbGateway = new DBGateway({ apiKey: apiKey!, task: "database", endpoint: "https://centrala.ag3nts.org/apidb" });
const neo4jService = new Neo4jService(
    process.env.NEO4J_URI || "bolt://localhost:7687",
    process.env.NEO4J_USER || "neo4j",
    process.env.NEO4J_PASSWORD || "password",
    openAIService
);

type User = {
    id: number;
    username: string;
    access_level: string;
    is_active: number;
    lastlog: string;
}

type Connection = {
    user1_id: number;
    user2_id: number;
}

async function clearDatabase() {
    await neo4jService.runQuery("MATCH (n) DETACH DELETE n");
}

async function main() {
    try {
        // Clear existing data
        await clearDatabase();

        // Get users and connections from MySQL
        const users: DBResponse<User> = await dbGateway.query<User>("SELECT * FROM users");
        const connections: DBResponse<Connection> = await dbGateway.query<Connection>("SELECT * FROM connections");
        console.log(JSON.stringify(users, null, 2));
        console.log(JSON.stringify(connections, null, 2));

        // Add users to Neo4j
        console.log("Adding users to Neo4j...");
        for (const user of users.reply) {
            await neo4jService.addNode("Person", {
                id: user.id,
                name: user.username
            });
        }

        // Add connections to Neo4j
        console.log("Adding connections to Neo4j...");
        for (const conn of connections.reply) {
            await neo4jService.runQuery(`
                MATCH (a:Person {id: $user1Id}), (b:Person {id: $user2Id})
                CREATE (a)-[:KNOWS]->(b)
            `, {
                user1Id: conn.user1_id,
                user2Id: conn.user2_id
            });
        }

        // Find shortest path from Rafał to Barbara
        console.log("Finding shortest path...");
        const pathQuery = `
            MATCH (start:Person {name: 'Rafał'}),
                  (end:Person {name: 'Barbara'}),
                  path = shortestPath((start)-[:KNOWS*]->(end))
            RETURN [node IN nodes(path) | node.name] as names
        `;

        const result = await neo4jService.runQuery(pathQuery);
        
        if (result.records.length === 0) {
            throw new Error("No path found between Rafał and Barbara");
        }

        // Format the answer
        const names = result.records[0].get('names');
        const answer = names.join(", ");

        // Submit the answer
        const submitResult = await taskSubmitGateway.submit(answer, "text");
        console.log('Result:', submitResult);
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    } finally {
        await neo4jService.close();
    }
}

main();