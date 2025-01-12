import type { ChatCompletion } from "openai/resources/chat/completions";
import type { OpenAIService } from "../../../common/OpenAIService";
import type { Itool } from "../Itool";

const answerPrompt = (context: string) => `[Answer Based on Context]

<prompt_objective>
The exclusive purpose of this prompt is to answer the user's question based on the provided context.
</prompt_objective>

<prompt_rules>
- The AI must answer only based on the provided context.
- UNDER NO CIRCUMSTANCES should the AI use external knowledge or assumptions outside the given context.
- If the context contains relevant information, provide a concise answer based on that information.
- If the context lacks relevant information, respond with "missing data."
- The AI's response should be in simple text format.
</prompt_rules>

<prompt_examples>
USER: "Find the email address for the company support department."
CONTEXT: "For any inquiries, you can reach out to our support team at support@example.com."
AI: "support@example.com"

USER: "Find the email address for the company support department."
CONTEXT: "Our sales team can be contacted at sales@example.com."
AI: "missing data"

USER: "What is the phone number for customer service?"
CONTEXT: "For any inquiries, you can reach out to our support team at support@example.com."
AI: "missing data"

USER: "Locate the email for the support team."
CONTEXT: "Contact us at support@example.com for assistance."
AI: "support@example.com"

USER: "Find the email address for the company support department."
CONTEXT: "Our customer service is available 24/7."
AI: "missing data"
</prompt_examples>

You are now ready to answer the user's question based on the provided context.

<context>
${context}
</context>
`;

export interface AnswerInput {
  query: string;
  context: string;
}

export interface AnswerOutput {
  answer: string;
}

export class AnswerTool implements Itool<AnswerInput, AnswerOutput> {
  name = "answer";
  description = "Answer the query based on the context. If the context is not relevant, return 'missing data'.";
  inputDescription = "Query to answer";
  outputDescription = "Answer to the user's query.";

  private openAIService: OpenAIService;

  constructor(openAIService: OpenAIService) {
    this.openAIService = openAIService;
  }

  async process(input: AnswerInput): Promise<AnswerOutput> {
    const query = input.query;
    const context = input.context;
    const response = await this.openAIService.completion({
        messages: [
          { role: "system", content: answerPrompt(context) },
          { role: "user", content: query }
        ],
        jsonMode: false
    });
    const content = (response as ChatCompletion).choices?.[0]?.message?.content;
    return { answer: content || "missing data" };
  }
}   