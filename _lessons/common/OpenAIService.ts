import { Tokenizer } from "./Tokenizer";
import { observeOpenAI } from "langfuse";
import OpenAI, { toFile } from "openai";
import type { ChatCompletionMessageParam, ChatCompletion, ChatCompletionChunk } from "openai/resources/chat/completions";
import type { ParsingError } from "./types";
import type { CreateEmbeddingResponse } from 'openai/resources/embeddings';
import { ElevenLabsClient } from "elevenlabs";
import Groq from "groq-sdk/index.mjs";
import type { Stream } from "stream";


// import { Langfuse } from "langfuse";
 
// const langfuse = new Langfuse();
 
// const trace = langfuse.trace({
//   name: "my-AI-application-endpoint",
// });

export class OpenAIService {
  private openai: OpenAI;
  private tokenizer: Tokenizer;
  private elevenlabs: ElevenLabsClient;
  private groq: Groq;

  constructor(opts?: {tracing?: boolean}) {
    if (opts?.tracing) {
      console.log("Tracing enabled");
      this.openai = observeOpenAI(new OpenAI(), {
        generationName: "OpenAI.Chat.Trace",
      });
    }else {
      this.openai = new OpenAI();
    }
    this.tokenizer = new Tokenizer();
    this.elevenlabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY
    });
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }

  async completion({
    messages,
    model = "gpt-4o",
    stream = false,
    jsonMode = false,
    maxTokens = 16384
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

  async transcribe(audioBuffer: Buffer): Promise<string> {
    console.log("Transcribing audio...");
    
    const transcription = await this.openai.audio.transcriptions.create({
      file: await toFile(audioBuffer, 'speech.mp3'),
      language: 'pl',
      model: 'whisper-1',
  });
    return transcription.text;
  }


  async transcribeGroq(audioBuffer: Buffer): Promise<string> {
    const transcription = await this.groq.audio.transcriptions.create({
      file: await toFile(audioBuffer, 'speech.mp3'),
      language: 'pl',
      model: 'whisper-large-v3',
    });
    return transcription.text;
  }

  async speak(text: string): Promise<ReadableStream<Uint8Array> | null> {
    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    });
  
    console.log("Response:", response.body);
    const stream = response.body;
    return stream;
  }

  async speakEleven(
    text: string,
    voice: string = "21m00Tcm4TlvDq8ikWAM",
    modelId: string = "eleven_turbo_v2_5"
  ): Promise<Stream> {
    try {
      const audioStream = await this.elevenlabs.generate({
        voice,
        text,
        model_id: modelId,
        stream: true,
      });

      return audioStream;
    } catch (error) {
      console.error("Error in ElevenLabs speech generation:", error);
      throw error;
    }
  }
  
  async generateImage({
    prompt,
    model = "dall-e-3",
    size = "1024x1024",
    quality = "standard",
    style = "natural",
    n = 1
  }: {
    prompt: string,
    model?: "dall-e-2" | "dall-e-3",
    size?: "1024x1024" | "1792x1024" | "1024x1792",
    quality?: "standard" | "hd",
    style?: "natural" | "vivid",
    n?: number
  }) {
    try {
      const response = await this.openai.images.generate({
        model,
        prompt,
        n,
        size,
        quality,
        style,
        response_format: "url"
      });

      return response.data;
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  }
}