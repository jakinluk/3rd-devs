import type { IAgent } from "./IAgent";
import type { OpenAIService } from "../../common/OpenAIService";
import type { Itool } from "../tools/Itool";
import type { ChatCompletion } from "openai/resources/chat/completions";
import type { AnswerInput, AnswerTool } from "../tools/answer/answer-tool";
import type { ScrapeTool } from "../tools/scrape/scrape-tool";
import type { FindLinksTool } from "../tools/find-links/find-links";

const planPrompt = (context: string, tools: Itool<any, any>[]) => `You are a Task Query Analyzer and Planner, focusing exclusively on the user's photo analysis request. Your primary role is to interpret the latest user request and divide it into comprehensive subqueries for different tools.

<prompt_objective>
Analyze the user's request about photo analysis and create a detailed plan using available tools. Each step should be self-contained and preserve all relevant information from the query.
</prompt_objective>

<prompt_rules>
- Reply in JSON format as described in the output format
- Focus exclusively on the user's most recent request
- Track progress through the context to avoid repeating steps
- Steps are executed in order. We can consider following scenarios:
  - If context is empty, extract URL from user query for scrape tool, followed by answer tool
  - If last step registered in context is answer tool with 'missing data', return just find-links tool
  - If last step registered in context is find-links tool, use the URL it returned for scrape tool, followed by answer tool
- find-links must be a standalone step
- scrape tool URL source rules:
  - When context is empty: Extract URL from user query
  - when context not empty: Use the URL returned by find-links. Always build absolute URL and pass it to scrape tool.
</prompt_rules>

<available_tools>
${tools.map(tool => ` - ${tool.name} - ${tool.description}
    -- input description: ${tool.inputDescription}
    -- output description: ${tool.outputDescription}
`
).join("\n")}
</available_tools>

<output_format>
{
  "_thinking": "Thinking about the user's request and the available tools",
  "steps": [
    {
      "tool_name": "parameters for the tool"
    }
  ]
}
</output_format>

<example>
User: "What does the Bun documentation at https://bun.sh/docs/api/fetch say about its fetch API?"

{
  "_thinking": "Context is empty. Following the rules, we need to:
   1. First scrape the provided URL
   2. Use the answer tool to analyze the scraped content",
  "steps": [
    {
      "scrape": "https://bun.sh/docs/api/fetch"
    },
    {
      "answer": "What are the key features and characteristics of Bun's fetch API based on the scraped content?"
    }
  ]
}

User: "What does the Bun documentation at https://bun.sh/docs/api/fetch say about its fetch API?"

{
  "_thinking": "Last step in context was 'answer' with 'missing data'. According to rules, we should only use find-links as a standalone step to discover relevant URLs",
  "steps": [
    {
      "find-links": "bun fetch API documentation"
    }
  ]
}

User: "What does the Bun documentation at https://bun.sh/docs/api/fetch say about its fetch API?"

{
  "_thinking": "Last step in context was 'find-links' that returned URL https://bun.sh/assets. Following the rules, we need to:
   1. Scrape the URL https://bun.sh/assets
   2. Generate an answer based on the updated content",
  "steps": [
    {
      "scrape": "https://bun.sh/assets"
    },
    {
      "answer": "What are the key features and characteristics of Bun's fetch API implementation?"
    }
  ]
}
</example>
Remember, your sole function is to generate these JSON responses based on task-related conversations. Do not engage in direct responses to queries.
You are now ready to plan steps. Here is the real context:
<context>
${context || "No previous steps executed"}
</context>
`;


function buildStepContext(step: Step, result: any): string {
    const stepName = Object.keys(step)[0];
    // return `\n<${stepName}>\n<params>${step[stepName]}</params>\n\t<result>${JSON.stringify(result)}</result>\n</${stepName}>`;
    return `\n<step name="${stepName}" params="${step[stepName]}">\n<result>\n${JSON.stringify(result, null, 2)}\n</result>\n</step>`;
}

const THINK_TIME = 5000;

interface Step {
  [key: string]: any;
}

export class WebSiteScrapeAgent implements IAgent {
  private tools: Itool<any, any>[] = [];
  private toolsMap: Record<string, Itool<any, any>> = {};

  constructor(private readonly openAIService: OpenAIService) {}

  public registerTools(tools: Itool<any, any>[]) {
    this.tools = tools;
    this.toolsMap = tools.reduce((acc, tool) => {
      acc[tool.name] = tool;
      return acc;
    }, {} as Record<string, Itool<any, any>>);
  }

    async process(input: string): Promise<string> {
        let context = "";
        let iteration = 0;
        const MAX_ITERATIONS = 10;

        const scrapedLinks: string[] = ['/'];

        while (iteration < MAX_ITERATIONS) {
            console.log("Iteration:", iteration);
            console.log("Plan prompt:", planPrompt(context, this.tools));
            console.log("CONTEXT:", context);
            const plan = await this.openAIService.completion({
            messages: [
                { role: "system", content: planPrompt(context, this.tools) },
                { role: "user", content: input }
            ],
            jsonMode: true
            });

            const {_thinking, steps} = this.openAIService.parseJsonResponse<{ _thinking: string, steps: Step[] }>(plan as ChatCompletion);
            console.log("PLAN THINKING:", _thinking);
            console.log("PLAN STEPS:", JSON.stringify(steps, null, 2));
            
            for (const step of steps) {
                const stepName = Object.keys(step)[0];
                console.log("STEP NAME", stepName);
                const scrapedLinksString = `- Already processed links: [${scrapedLinks.join(", ")}]\n`;
                // console.log("ALREADY PROCESSED LINKS", scrapedLinksString);
                const result = await this.executeStep(step, stepName === "find-links" ? `${scrapedLinksString}\ncontext: ${context}` : context);
                context += buildStepContext(step, result);

                if (stepName === "scrape") {
                    scrapedLinks.push(step["scrape"]);
                }
                
                if (stepName === "answer" && !result.answer.includes('missing data')) {
                    return result.answer;
                }
                await new Promise(resolve => setTimeout(resolve, THINK_TIME));
              }

              await new Promise(resolve => setTimeout(resolve, THINK_TIME));
              iteration++;
            }

        return "I'm sorry, I couldn't find the answer to your question.";
    }

    private async executeStep(step: Step, context: string): Promise<Record<string, any>> {
        const [toolName] = Object.keys(step);
        const inputForTool = step[toolName];
      
        switch (toolName) {
          case "scrape": {
            const tool = this.toolsMap["scrape"] as ScrapeTool;
            console.log("Scraping", inputForTool);
            return await tool.process({ url: inputForTool as string });
          }
      
          case "answer": {
            const tool = this.toolsMap["answer"] as AnswerTool;
            return await tool.process({ query: inputForTool as string, context });
          }
      
          case "find-links": {
            console.log("CONTEXT", context);
            const tool = this.toolsMap["find-links"] as FindLinksTool;
            const result = await tool.process({ query: inputForTool as string, context });
            return { urls: [result.urls[0]] };
          }
      
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
      }
}