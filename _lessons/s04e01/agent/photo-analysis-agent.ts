import type { IAgent } from "./IAgent";
import type { OpenAIService } from "../../common/OpenAIService";
import type { Itool } from "../tools/Itool";
import type { ChatCompletion } from "openai/resources/chat/completions";
import type { FetchPhotosTool } from "../tools/fetch-photos/fetch-photos-tool";
import type { FixPhotosTool } from "../tools/fix-photos/fix-photos-tool";
import type { DescribePhotosInput, DescribePhotosTool } from "../tools/describe-photos/describe-photos-tool";
import type { AnswerTool } from "../tools/answer/answer-tool";

const planPrompt = (context: string, tools: Itool<any, any>[]) => `You are a Task Query Analyzer and Planner, focusing exclusively on the user's photo analysis request. Your primary role is to interpret the latest user request and divide it into comprehensive subqueries for different tools.

<prompt_objective>
Analyze the user's request about photo analysis and create a detailed plan using available tools. Each step should be self-contained and preserve all relevant information from the query.
</prompt_objective>

<context>
${context || "No previous steps executed"}
</context>

<prompt_rules>
- Reply in JSON format as described in the output format
- Focus exclusively on the user's most recent request
- Analyze the entire request to extract all photo-related information
- Track progress through the context to avoid repeating steps
- Each step must contain ALL necessary details from the request
- Consider dependencies between steps:
  * Photos must be fetched before fixing
  * Photos must be fixed before describing
  * Fixing step if planned should be the last step in a iteration
  * Describe step if planned should be the first step in a iteration
  * Photos must be described before answering but but not in the same iteration
- For fetch-photos:
  * Include all mentioned URLs and file names from the user query
  * fetch photos to work need to know full url path to the photos or base path and file names
- For fix-photos:
  * Include all mentioned file names from the user query
- For describe-photos:
  * Include only the photos returned as fixed from fix-photos step
  * Build a hint what to look for in the photos based on the user query
- For answer:
  * Use always after describe-photos step
  * The actual question content distilled from the user's statement. Without unnecessary context that has already been included in the steps of searching or fixing photos. But including any suggestions the user has about what the answer should contain.
- In the "_thinking" field:
  * Explain your reasoning for the current plan phase
  * Consider and discuss different options
  * Justify your choices
  * Mention any assumptions made
  * Highlight any ambiguities and how you resolved them
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
Iteration 1: Initial photo fetch
{
  "_thinking": "Starting new photo analysis task.\nNo previous steps executed. User mentioned specific photo files at a URL.\nNeed to fetch photos before any analysis can begin.\nWill have local copies of photos for processing. Try to fix all the photos",
  "steps": [
    {
      "fetch-photos": "https://example.com/photos/IMG_001.jpg, IMG_002.jpg mentioned in user query"
    },
    {
      "fix-photos": "IMG_001.jpg,IMG_002.jpg"
    }
  ]
}

Iteration 2: Describe photos and answer
{
  "_thinking": "Fixed photos fetched and all are fixed. Now let's describe what was found on each photo and answer the user's question",
  "steps": [
    {
      "describe-photos": {
        "photos": "IMG_001.jpg, IMG_002.jpg",
        "hint": "Distiled hint what to look for in the photos based on the user query"
      }
    },
    {
      "answer": "Distiled user query"
    }
  ]
}
</example>
Remember, your sole function is to generate these JSON responses based on task-related conversations. Do not engage in direct responses to queries.
`;


function buildStepContext(step: Step, result: any): string {
    const stepName = Object.keys(step)[0];
    // return `\n<${stepName}>\n<params>${step[stepName]}</params>\n\t<result>${JSON.stringify(result)}</result>\n</${stepName}>`;
    return `\n<step name="${stepName}">\n<result>\n${JSON.stringify(result, null, 2)}\n</result>\n</step>`;
}

const THINK_TIME = 5000;

interface Step {
  [key: string]: any;
}

export class PhotoAnalysisAgent implements IAgent {
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

        while (iteration < MAX_ITERATIONS) {
            console.log("Iteration:", iteration);
            // console.log("Plan prompt:", planPrompt(context));
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
            const result = await this.executeStep(step, context);
            context += buildStepContext(step, result);
            
            if (Object.keys(step)[0] === "answer") {
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
          case "fetch-photos": {
            const tool = this.toolsMap["fetch-photos"] as FetchPhotosTool;
            return await tool.process({ query: inputForTool as string });
          }
      
          case "fix-photos": {
            const tool = this.toolsMap["fix-photos"] as FixPhotosTool;
            const filesToFix = (inputForTool as string).split(",").map( s => s.trim());
            return await tool.process({ toFix: filesToFix.join(",") });
          }
      
          case "describe-photos": {
            const tool = this.toolsMap["describe-photos"] as DescribePhotosTool;
            return await tool.process(inputForTool as DescribePhotosInput);
          }
      
          case "answer": {
            const tool = this.toolsMap["answer"] as AnswerTool;
            return await tool.process({ query: inputForTool as string, context });
          }
      
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
      }
}