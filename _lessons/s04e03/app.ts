import { OpenAIService } from "../common/OpenAIService";
import express from "express";
import { WebSiteScrapeAgent } from "./agent/web-site-scrape-agent";
import { AnswerTool } from "./tools/answer/answer-tool";
import { ScrapeTool } from "./tools/scrape/scrape-tool";
import { FindLinksTool } from "./tools/find-links/find-links";

const app = express();
app.use(express.json());

const apiKey = process.env.PERSONAL_API_KEY;
const task = "photos";
const endpoint = "https://centrala.ag3nts.org/report";

// const taskSubmitGateway = new TaskSubmitGateway({ apiKey: apiKey!, task: task, endpoint: endpoint });
const openAIService = new OpenAIService({ tracing: false, useOpenRouter: true });

const agent = new WebSiteScrapeAgent(openAIService);
agent.registerTools([new ScrapeTool(), new AnswerTool(openAIService), new FindLinksTool(openAIService)]);

async function main(query: string) {
  try {

    const result = await agent.process(query);

    console.log("Result:", result);


  } catch (error) {
    console.error("Error processing chat:", error);
  }
};

// main("przeszukaj https://softo.ag3nts.org/ i podsj adres mailowy do firmy SoftoAI");
// "kontakt@softoai.whatever"
// main("źródło: https://softo.ag3nts.org/ , pytanie: Jaki jest adres interfejsu webowego do sterowania robotami zrealizowanego dla klienta jakim jest firma BanAN? (wskazówka - portfolio)");
// Result: https://banan.ag3nts.org
main("źródło: https://softo.ag3nts.org/ , pytanie: `Jakie dwa certyfikaty jako\u015bci ISO otrzyma\u0142a firma SoftoAI?`");
// Result: ISO 9001 and ISO/IEC 27001