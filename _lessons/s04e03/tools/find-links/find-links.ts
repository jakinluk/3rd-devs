import type { ChatCompletion } from "openai/resources/chat/completions";
import type { OpenAIService } from "../../../common/OpenAIService";
import type { Itool } from "../Itool";

const answerPrompt = (context: string) => `# Link Relevance Extractor

A specialized prompt for extracting and prioritizing relevant links from given context while excluding previously processed ones.

<prompt_objective>
Analyze the provided context, identify all relevant links (both absolute and relative), and return the top 3 most relevant URLs based on the user's question, excluding any previously processed links.
</prompt_objective>

<prompt_rules>
- ONLY return links that actually appear in the provided context
- NEVER create, modify, or guess any URLs
- ALWAYS exclude links from the provided array of processed links
- MUST return response in JSON format with "thinking" and "urls" properties
- LIMIT returned links to maximum of 3, ordered by relevance to the question
- INCLUDE both absolute and relative URLs as they appear in the context
- ANALYZE relevance based on surrounding context and question intent
</prompt_rules>

<prompt_examples>
USER: "How to install Python?"
CONTEXT: 
- Already processed links: [https://python.org/downloads/, /docs/installation]
- Text with links:
"Python can be installed from /downloads/guide or https://realpython.com/installing-python/. Check also /getting-started and ../setup/. For beginners, you might also find https://w3schools.com/python/python_getstarted.asp helpful."

AI: {
    "thinking": "Prioritizing installation-specific links first. The RealPython link typically provides comprehensive installation guides. Relative paths to getting-started and setup are also relevant but ranked lower as they might cover broader topics.",
    "urls": [
        "https://realpython.com/installing-python/",
        "/getting-started",
        "../setup/"
    ]
}

USER: "Python documentation?"
CONTEXT:
- Already processed links: [/docs/tutorial, https://docs.python.org/3/]
- Text with links:
"Check our docs at /documentation/start, ./quickstart, or visit https://readthedocs.io/python. More at ../advanced/docs"

AI: {
    "thinking": "Selected documentation-specific links, excluding already processed links. Prioritized the main documentation start page, followed by quickstart guide and advanced docs.",
    "urls": [
        "/documentation/start",
        "./quickstart",
        "../advanced/docs"
    ]
}
</prompt_examples>

You are now ready to process questions and return relevant links based on provided context, always excluding previously processed links and maintaining the specified JSON response format.
In case all relevant links are already processed, take first not processed link from the context.

<context>
${context}
</context>
`;

interface FindLinksInput {
  query: string;
  context: string;
}

interface FindLinksOutput {
  thinking: string;
  urls: string[];
}

export class FindLinksTool implements Itool<FindLinksInput, FindLinksOutput> {
  name = "find-links";
  description = "Find relevant links based on the user's query and context";
  inputDescription = "Users query";
  outputDescription = "Relevant links based on the user's query and context";

  private openAIService: OpenAIService;

  constructor(openAIService: OpenAIService) {
    this.openAIService = openAIService;
  }

  async process(input: FindLinksInput): Promise<FindLinksOutput> {
    const query = input.query;
    const context = input.context;
    console.log("FIND-LINKS CONTEXT", context);
    const answer = await this.openAIService.completion({
        messages: [
          { role: "system", content: answerPrompt(context) },
          { role: "user", content: query }
        ],
        jsonMode: true
    });
    return this.openAIService.parseJsonResponse<FindLinksOutput>(answer as ChatCompletion);
  }
}   