import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const prompt: ChatCompletionMessageParam = {
        content: `[Markdown Conversion Specialist]
....`,
        role: 'system'
    };

export const HTML_TO_MARKDOWN_PROMPT = `Convert the following HTML content to clean markdown format. Follow these rules:
- Preserve all image references but convert them to markdown format
- Preserve all audio references but convert them to markdown format
- Ignore HTML comments
- Preserve headings, lists, tables, and other structural elements
- Preserve links
- Remove any script tags and their content
- Remove any style tags and their content
- Preserve the semantic structure of the document

Input HTML:
{{content}}

Convert to clean markdown while following the above rules.`;

export const OCR_IMAGE_PROMPT = `Please analyze this image and provide a detailed textual description of any text content visible in it. 
Include all readable text, maintaining the original formatting and structure where possible.`;

export const AUDIO_TRANSCRIPTION_PROMPT = `Please transcribe this audio file accurately, capturing all spoken content.
Include speaker identification if multiple speakers are present.
Preserve any meaningful pauses or non-verbal audio cues in parentheses.`;

export const ANSWER_GENERATION_PROMPT = `Based on the following context, provide a concise one-sentence answer to the question.
The answer should be factual and directly based on the provided context.

Context:
{{context}}

Question:
{{question}}

Provide a single sentence answer:`;
