import { OpenAIService } from "../common/OpenAIService";
import { TaskSubmitGateway } from "../common/TaskSubmitGateway";
import type { ChatCompletion, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { extractNameAndPlacesPrompt, findMostRelevantPlaceToFindBarbaraPrompt } from "./prompts";
import path from "path";
import fs from "fs";
// Gateway for the People and Places APIs
class AgentsGateway {
    private readonly httpClient = new HttpClient();
    constructor(private readonly apiKey: string) {}

    async searchReportsForPeople(name: string): Promise<string> {
        const response = await this.httpClient.post<{ apikey: string, query: string }, { code: number, message: string }>(
            'https://centrala.ag3nts.org/people',
            { apikey: this.apiKey, query: name },
            'json'
        );
        console.log("People search response:", JSON.stringify(response, null, 2));

        if (response.code !== 0) {
            throw new Error(`People search failed: ${response.message}`);
        }

        return response.message;
    }

    async searchReportsForPlaces(city: string): Promise<string> {
        const response = await this.httpClient.post<{ apikey: string, query: string }, { code: number, message: string }>(
            'https://centrala.ag3nts.org/places',
            { apikey: this.apiKey, query: city },
            'json'
        );
        console.log("Places search response:", JSON.stringify(response, null, 2));

        if (response.code !== 0) {
            throw new Error(`Places search failed: ${response.message}`);
        }

        return response.message;
    }

    async getNote(): Promise<string> {
        return await this.httpClient.get('https://centrala.ag3nts.org/dane/barbara.txt', 'text');
    }
}

// HTTP Client similar to the one in TaskSubmitGateway
class HttpClient {
    async post<T, R>(url: string, data: T, type: "json" | "text"): Promise<R> {
        const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return type === "json" ? response.json() : response.text();
    }

    async get(url: string, type: "json" | "text"): Promise<any> {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return type === "json" ? response.json() : response.text();
    }
}

// Graph to track connections between people and places
// DO NOT USE IT YET
class ConnectionGraph {
    private people: Set<string> = new Set();
    private places: Set<string> = new Set();
    private connections: Map<string, Set<string>> = new Map();

    addPerson(name: string) {
        this.people.add(name);
    }

    addPlace(place: string) {
        this.places.add(place);
    }

    addConnection(person: string, place: string) {
        if (!this.connections.has(person)) {
            this.connections.set(person, new Set());
        }
        this.connections.get(person)?.add(place);
    }

    getPlacesForPerson(person: string): string[] {
        return Array.from(this.connections.get(person) || []);
    }

    getPeopleInPlace(place: string): string[] {
        const people: string[] = [];
        this.connections.forEach((places, person) => {
            if (places.has(place)) {
                people.push(person);
            }
        });
        return people;
    }

    getAllPeople(): string[] {
        return Array.from(this.people);
    }

    getAllPlaces(): string[] {
        return Array.from(this.places);
    }
}

const apiKey = process.env.PERSONAL_API_KEY;
const task = "loop";
const endpoint = "https://centrala.ag3nts.org/report";

const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task, endpoint });
const openAIService = new OpenAIService({ tracing: true });
const agentsGateway = new AgentsGateway(apiKey!);

async function extractNamesAndPlaces(text: string): Promise<{ names: string[], places: string[] }> {
    const messages: ChatCompletionMessageParam[] = [
        extractNameAndPlacesPrompt(text),
        {
            role: "user",
            content: text
        }
    ];

    const completion = await openAIService.completion({ messages, jsonMode: true });
    const resp = openAIService.parseJsonResponse<{ names: string[], places: string[] }>(completion as ChatCompletion) as { names: string[], places: string[] };
    console.log("Extracted names and places:", JSON.stringify(resp, null, 2));

    return {
        names: resp.names.map(name => name.toUpperCase().split(" ")[0]),
        places: resp.places.map(place => place.toUpperCase())
    };
}

async function findMostRelevantPlaceToFindBarbara(context: string, placesAlreadyChecked: string[]): Promise<{ thinking: string, city: string }> {
    const messages: ChatCompletionMessageParam[] = [
        findMostRelevantPlaceToFindBarbaraPrompt(context, placesAlreadyChecked),
        {
            role: "user",
            content: context
        }
    ];

    const completion = await openAIService.completion({ messages, jsonMode: true });
    const resp = openAIService.parseJsonResponse<{ thinking: string, city: string }>(completion as ChatCompletion) as { thinking: string, city: string };
    console.log("Most relevant place to find Barbara:", JSON.stringify(resp, null, 2));

    return resp;
}

type Note = {
    type: "person" | "place";
    noteFor: string;
    noteContent: string;
}

type ProcessedNote = {
    noteFor: string;
    noteContent: string;
    considerations: string;
}

async function processPlace(place: string): Promise<{ note: Note, names: string[], places: string[] }> {
    const note = await agentsGateway.searchReportsForPlaces(place);
    const { names, places } = await extractNamesAndPlaces(note);
    return {
        note: {
            type: "place",
            noteFor: place,
            noteContent: note,
        },
        names,
        places,
    };
}

async function processName(name: string): Promise<{ note: Note, places: string[], names: string[] }> {
    const note = await agentsGateway.searchReportsForPeople(name);
    const { places, names } = await extractNamesAndPlaces(note);
    return {
        note: {
            type: "person",
            noteFor: name,
            noteContent: note,
        },
        places,
        names,
    };
}

async function main() {
    try {

        // //  Initialize graph and add initial data
        //      const graph = new ConnectionGraph();

        // Get and analyze the note about Barbara
        console.log("Getting note about Barbara...");
        const startingNote = await agentsGateway.getNote();
        console.log("Note:", startingNote);
        const { names, places } = await extractNamesAndPlaces(startingNote);

   
        
        // 3. Query APIs and build connections
        console.log("Building connections graph...");
        const processedNames = new Set<string>();
        const processedPlaces = new Set<string>();

        const iterationMax = 10;
        let iteration = 0;

        let namesToProcess = names;
        let placesToProcess = places;

        // load notes from file
        const notesFilePath = path.join(__dirname, "notes.json");
        const notes = (fs.existsSync(notesFilePath) ? JSON.parse(fs.readFileSync(notesFilePath, "utf-8")) : []) as Note[];

        if (notes.length === 0) {
            while (iteration < iterationMax && (namesToProcess.length > 0 || placesToProcess.length > 0)) {
                console.log("Iteration:", iteration);
                console.log("Names to process:", namesToProcess);
                console.log("Places to process:", placesToProcess);
                // Process initial names and places
                const name = namesToProcess.shift();
                if (name) {
                    const { note, places, names: newNames } = await processName(name);
                    notes.push(note);
                    processedNames.add(name);
                    namesToProcess.push(...(newNames.filter(n => !processedNames.has(n)) || []));
                    placesToProcess.push(...(places.filter(p => !processedPlaces.has(p)) || []));
                }

                const place = placesToProcess.shift();
                if (place) {
                    const { note, names, places: newPlaces } = await processPlace(place);
                    notes.push(note);
                    processedPlaces.add(place);
                    placesToProcess.push(...(newPlaces.filter(p => !processedPlaces.has(p)) || []));
                    namesToProcess.push(...(names.filter(n => !processedNames.has(n)) || []));
                }
                iteration++;
                // wait 2 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // persist notes to file
            fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2));
        }

        const context = "Wstępne informacje:\n" + startingNote + "\n\nRaporty:\n" + notes.map(note => {
            if (note.type === "person") {
                return `- osobę ${note.noteFor} widziano w ${note.noteContent}`;
            } else {
                return `- w mieście ${note.noteFor} widziano ${note.noteContent}`;
            }
        }).join("\n\n");
        console.log("Context:", context);
        // load placesAlreadyChecked from file  
        const placesAlreadyCheckedFilePath = path.join(__dirname, "placesAlreadyChecked.json");
        const placesAlreadyChecked = fs.existsSync(placesAlreadyCheckedFilePath) ? JSON.parse(fs.readFileSync(placesAlreadyCheckedFilePath, "utf-8")) : [];

        const maxIterations = 10;
        iteration = 0;
        while (iteration < maxIterations) {
            // Find Barbara's location
            const { thinking, city } = await findMostRelevantPlaceToFindBarbara(context, placesAlreadyChecked);
            console.log("Thinking:", thinking);
            console.log("City:", city);
            const result = await taskSubmitGateway.submit(city, "json");
            console.log("taskSubmitGateway Result:", result);
            if (result.code === 0) {
                console.log("Barbara found!");
                break;
            }
            placesAlreadyChecked.push(city);
            iteration++;
            // wait 2 seconds
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        // save placesAlreadyChecked to file
        fs.writeFileSync(placesAlreadyCheckedFilePath, JSON.stringify(placesAlreadyChecked, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

main();