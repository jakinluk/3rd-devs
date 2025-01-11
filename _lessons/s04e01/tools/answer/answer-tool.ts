import type { ChatCompletion } from "openai/resources/chat/completions";
import type { OpenAIService } from "../../../common/OpenAIService";
import type { Itool } from "../Itool";

const answerPrompt = (context: string) => `You are a helpful assistant.

<objective>
Answer the query based on the context.
</objective>

<context>
${context || "No analysis results available"}
</context>

<rules>
- respond in JSON format
- Write in formal Polish language
- Use output format below
</rules>

<output_format>
{
  "_thinking": "your thoughts on how to answer the query",
  "answer": "Answer to the query in Polish language"
}
</output_format>`;

interface AnswerInput {
  query: string;
  context: string;
}

interface AnswerOutput {
  answer: string;
}

export class AnswerTool implements Itool<AnswerInput, AnswerOutput> {
  name = "answer";
  description = "Answer the query based on the context";
  inputDescription = "Query to answer";
  outputDescription = "Answer to the user's query.";

  private openAIService: OpenAIService;

  constructor(openAIService: OpenAIService) {
    this.openAIService = openAIService;
  }

  async process(input: AnswerInput): Promise<AnswerOutput> {
    const query = input.query;
    const context = input.context;
    const answer = await this.openAIService.completion({
        messages: [
          { role: "system", content: answerPrompt(context) },
          { role: "user", content: query }
        ],
        jsonMode: true
    });
    return this.openAIService.parseJsonResponse<AnswerOutput>(answer as ChatCompletion);
  }
}   