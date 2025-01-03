import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createByModelName } from '@microsoft/tiktokenizer';

export class Tokenizer {
  private tokenizers: Map<string, Awaited<ReturnType<typeof createByModelName>>> = new Map();
  private readonly IM_START = "<|im_start|>";
  private readonly IM_END = "<|im_end|>";
  private readonly IM_SEP = "<|im_sep|>";

  private readonly SPECIAL_TOKENS = new Map<string, number>([
    [this.IM_START, 100264],
    [this.IM_END, 100265],
    [this.IM_SEP, 100266],
  ]);


  private async getTokenizer(modelName: string) {
    if (!this.tokenizers.has(modelName)) {
      const tokenizer = await createByModelName(modelName, this.SPECIAL_TOKENS);
      this.tokenizers.set(modelName, tokenizer);
    }
    return this.tokenizers.get(modelName)!;
  }

  async countTokens(messages: ChatCompletionMessageParam[], model: string = 'gpt-4o'): Promise<number> {
    const tokenizer = await this.getTokenizer(model);

    let formattedContent = '';
    messages.forEach((message) => {
      formattedContent += `${this.IM_START}${message.role}${this.IM_SEP}${message.content || ''}${this.IM_END}`;
    });
    formattedContent += `${this.IM_START}assistant${this.IM_SEP}`;

    const tokens = tokenizer.encode(formattedContent, [this.IM_START, this.IM_END, this.IM_SEP]);
    return tokens.length;
  }

  async countTokensSingle(text: string, model: string = 'gpt-4o'): Promise<number> {
    const tokenizer = await this.getTokenizer(model);

    const formattedContent = this.formatForTokenization(text);
    const tokens = tokenizer.encode(formattedContent, Array.from(this.SPECIAL_TOKENS.keys()));
    return tokens.length;
  }

  private formatForTokenization(text: string): string {
    return `<|im_start|>user\n${text}<|im_end|>\n<|im_start|>assistant<|im_end|>`;
  }
}