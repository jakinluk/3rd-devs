import { OpenAIService } from "../common/OpenAIService";
import express from "express";
import { join } from "path";
import { FetchPhotosTool } from "./tools/fetch-photos/fetch-photos-tool";
import { FixPhotosTool } from "./tools/fix-photos/fix-photos-tool";
import { FixPhotosClient } from "./tools/fix-photos/fix-photos-client";
import { PhotoFetcher } from "./tools/fetch-photos/photo-fetcher";
import { DescribePhotosTool } from "./tools/describe-photos/describe-photos-tool";
import { AnswerTool } from "./tools/answer/answer-tool";
import { PhotoAnalysisAgent } from "./agent/photo-analysis-agent";

const app = express();
app.use(express.json());

const apiKey = process.env.PERSONAL_API_KEY;
const task = "photos";
const endpoint = "https://centrala.ag3nts.org/report";

// const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task: task, endpoint: endpoint });
const openAIService = new OpenAIService({ tracing: false });
const photosDir = join(__dirname, "temp");

const fetchPhotosTool = new FetchPhotosTool(openAIService, new PhotoFetcher(photosDir));
const fixPhotosClient = new FixPhotosClient();
const fixPhotosTool = new FixPhotosTool(openAIService, fixPhotosClient, fetchPhotosTool, photosDir);
const describePhotosTool = new DescribePhotosTool(openAIService, photosDir);
const answerTool = new AnswerTool(openAIService);

const tools = [fetchPhotosTool, fixPhotosTool, describePhotosTool, answerTool];
const agent = new PhotoAnalysisAgent(openAIService);
agent.registerTools(tools);

// Chat endpoint
// app.post("/api/chat", async (req, res) => {
async function main(query: string) {
  try {
    // const { messages, conversation_id = uuidv4() } = req.body;
    
    // // Get the last user message
    // const lastMessage = messages.filter((m: any) => m.role === "user").pop();
    // if (!lastMessage) {
    //   return res.status(400).json({ error: "No user message found" });
    // }

    // Process the message
    const result = await agent.process(query);

    console.log("Result:", result);

    // // Return the response
    // return res.json({
    //   conversation_id,
    //   response: result
    // });

  } catch (error) {
    console.error("Error processing chat:", error);
    // return res.status(500).json({ 
    //   error: "An error occurred while processing your request",
    //   details: error instanceof Error ? error.message : "Unknown error"
    // });
  }
};
// });

// // Start the server
// const port = process.env.PORT || 3000;
// app.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });

main("Oto fotki, które udało nam się zdobyć: IMG_559.PNG, IMG_1410.PNG, IMG_1443_FT12.PNG, IMG_1444.PNG. Wszystkie siedzą sobie tutaj: https://centrala.ag3nts.org/dane/barbara/. Pobierz zdjęcia, napraw je i powiedz jak wygląda Barbara. Odpowiedz po Polsku!, uwzględnij wszystkie szczegóły jej wyglądu, cechy szczególne jak tatuarze, gdzie się znajdują. Załóż ,że Barbara to kobieta która pojawi się na więcej niż jednym zdjęciu.");

// Result: Barbara ma długie czarne włosy i nosi okulary. Na jednym ze zdjęć widać ją w szarym T-shircie, będącą na siłowni, z tatuażem przedstawiającym owada na lewym ramieniu. Na innym zdjęciu, ubrana podobnie, trzyma filiżankę kawy i stoi na zewnątrz, ale tatuaż nie jest tam widoczny. Zdjęcia te ukazują typowy wygląd Barbary, podkreślając jej długie czarne włosy, okulary oraz charakterystyczny tatuaż.