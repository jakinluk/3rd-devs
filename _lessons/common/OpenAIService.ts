import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { Tokenizer } from "./Tokenizer";
import { observeOpenAI } from "langfuse";

export class OpenAIService {
  private openai: OpenAI;
  private tokenizer: Tokenizer;

  constructor(opts?: {tracing?: boolean}) {
    this.openai = new OpenAI();
    if (opts?.tracing) {
      this.openai = observeOpenAI(this.openai);
    }
    this.tokenizer = new Tokenizer();
  }

  async completion(
    messages: ChatCompletionMessageParam[],
    model: string = "gpt-4",
    stream: boolean = false,
    jsonMode: boolean = false,
    maxTokens: number = 1024
  ): Promise<OpenAI.Chat.Completions.ChatCompletion | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    try {
      const tokenCount = await this.tokenizer.countTokens(messages, model);
      console.log(`Token count for model ${model}: ${tokenCount}`);
      if (tokenCount > maxTokens) {
        throw new Error(`Token count for model ${model} is greater than maxTokens: ${tokenCount}`);
      }

      const chatCompletion = await this.openai.chat.completions.create({
        messages,
        model,
        stream,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: "json_object" } : { type: "text" }
      });
      
      if (stream) {
        return chatCompletion as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
      } else {
        return chatCompletion as OpenAI.Chat.Completions.ChatCompletion;
      }
    } catch (error) {
      console.error("Error in OpenAI completion:", error);
      throw error;
    }
  }
}