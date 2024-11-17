import { Tokenizer } from "./Tokenizer";
import { observeOpenAI } from "langfuse";
import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletion, ChatCompletionChunk } from "openai/resources/chat/completions";
import type { ParsingError } from "./types";
import type { CreateEmbeddingResponse } from 'openai/resources/embeddings';


// import { Langfuse } from "langfuse";
 
// const langfuse = new Langfuse();
 
// const trace = langfuse.trace({
//   name: "my-AI-application-endpoint",
// });

export class OpenAIService {
  private openai: OpenAI;
  private tokenizer: Tokenizer;

  constructor(opts?: {tracing?: boolean}) {
    if (opts?.tracing) {
      console.log("Tracing enabled");
      this.openai = observeOpenAI(new OpenAI(), {
        generationName: "OpenAI.Chat.Trace_v2",
      });
    }else {
      this.openai = new OpenAI();
    }
    this.tokenizer = new Tokenizer();
  }

  async completion({
    messages,
    model = "gpt-4o",
    stream = false,
    jsonMode = false,
    maxTokens = 10240
  }: {
    messages: ChatCompletionMessageParam[],
    model?: string,
    stream?: boolean,
    jsonMode?: boolean,
    maxTokens?: number
  }): Promise<OpenAI.Chat.Completions.ChatCompletion | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    try {
      const tokenCount = await this.tokenizer.countTokens(messages, model);
      console.log(`Token count for model ${model}: ${tokenCount}`);
      if (tokenCount > maxTokens) {
        throw new Error(`Token count for model ${model} is greater than maxTokens: ${tokenCount}`);
      }

      // const generation = trace.generation({
      //   name: "chat-completion_v2",
      //   model,
      //   modelParameters: {
      //     jsonMode: jsonMode,
      //     maxTokens: maxTokens,
      //     stream: stream,
      //   },
      //   input: messages,
      // });

      const chatCompletion = await this.openai.chat.completions.create({
        messages,
        model,
        stream,
        max_tokens: maxTokens,
        response_format: jsonMode ? { type: "json_object" } : { type: "text" }
      });

      // generation.end({
      //   output: chatCompletion,
      // });
      
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

  isStreamResponse(response: ChatCompletion | AsyncIterable<ChatCompletionChunk>): response is AsyncIterable<ChatCompletionChunk> {
    return Symbol.asyncIterator in response;
  }

  parseJsonResponse<IResponseFormat>(response: ChatCompletion): IResponseFormat | ParsingError {
    try {
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Invalid response structure');
      }
      const parsedContent = JSON.parse(content);
      return parsedContent;
    } catch (error) {
      console.error('Error parsing JSON response:', error);
      return { error: 'Failed to process response', result: false };
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response: CreateEmbeddingResponse = await this.openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error creating embedding:", error);
      throw error;
    }
  }
}