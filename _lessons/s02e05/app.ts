import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import { VectorStore } from '../common/VectorStore';
import { OpenAIService } from '../common/OpenAIService';
import { 
    HTML_TO_MARKDOWN_PROMPT, 
    OCR_IMAGE_PROMPT, 
    ANSWER_GENERATION_PROMPT 
} from './prompts';
import type { ChatCompletion } from 'openai/resources/index.mjs';
import { TaskSubmitGateway } from '../common/TaskSubmitGateway';
import crypto from 'crypto';

interface QuestionAnswer {
    [key: string]: string;
}

const BASE_DIR = path.join(process.cwd(), '_lessons/s02e05');

export class ArxivProcessor {
    private readonly apiKey: string;
    private readonly openAIService: OpenAIService;
    private readonly vectorStore: VectorStore;
    private chunks: Map<string, string> = new Map();

    constructor() {
        this.apiKey = process.env.PERSONAL_API_KEY || '';
        this.openAIService = new OpenAIService({tracing: true});
        this.vectorStore = new VectorStore(1536, path.join(BASE_DIR, 'vector_store'));
    }

    async processArticle(): Promise<QuestionAnswer> {
        // 1. Get the article and questions
        const article = await this.fetchArticle();
        const questions = await this.fetchQuestions();

        // 2. Process media files
        await this.persistMediaFiles(BASE_DIR, article);

        // 3. Convert to markdown
        const filePath = path.join(BASE_DIR, 'article.md');
        let markdown = '';
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        if (fileExists) {
            markdown = await fs.readFile(filePath, 'utf-8');
        } else {
            markdown = await this.convertToMarkdown(article);
            await fs.writeFile(filePath, markdown, 'utf-8');
        }


        // 4. Process media content
        const processedMarkdown = await this.processMediaContent(markdown);

        // 5. Split and embed content
        this.splitIntoChunks(processedMarkdown);

        throw new Error('Stop here');
        await this.embedChunks();

        // 6. Process questions and generate answers
        return this.generateAnswers(questions);
    }

    private async fetchArticle(): Promise<string> {
        const response = await axios.get('https://centrala.ag3nts.org/dane/arxiv-draft.html');
        return response.data;
    }

    private async fetchQuestions(): Promise<string[]> {
        const response = await axios.get(`https://centrala.ag3nts.org/data/${this.apiKey}/arxiv.txt`);
        return response.data.split('\n').filter(Boolean);
    }

    private async persistMediaFiles(baseDir: string, html: string): Promise<void> {
        const mediaRegex = /<(?:img|source)\s+[^>]*?src=["']([^"']+)["'][^>]*>/g;
        const mediaFiles = [...html.matchAll(mediaRegex)].map(match => match[1]);
        console.log('Found media files:', mediaFiles);

        for (const file of mediaFiles) {
            const response = await axios.get(`https://centrala.ag3nts.org/dane/${file}`, {
                responseType: 'arraybuffer'
            });
            const filePath = path.join(baseDir, file);
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, response.data);
        }
    }

    private async convertToMarkdown(html: string): Promise<string> {
        const completion = await this.openAIService.completion({
            messages: [
                { role: 'system', content: HTML_TO_MARKDOWN_PROMPT.replace('{{content}}', html) }
            ]
        });
        const resp = (completion as ChatCompletion).choices[0].message.content;
        if (!resp) {
            throw new Error('No markdown content returned from OpenAI');
        }
        return resp;
    }

    private async processMediaContent(markdown: string): Promise<string> {
        let processedContent = markdown;

        // Process images - matches ![alt text](path/to/image.png)
        const imageRegex = /!\[([^\]]+)\]\(([^)]+\.png)\)/g;
        const processedImages = new Set<string>();

        for (const match of markdown.matchAll(imageRegex)) {
            const [fullMatch, alt, imagePath] = match;
            
            // Skip if we've already processed this image
            if (processedImages.has(imagePath)) {
                continue;
            }
            processedImages.add(imagePath);

            const imageFilePath = path.join(BASE_DIR, imagePath);
            const imageContent = await this.processImage(imageFilePath);
            // Replace all occurrences of this image reference
            processedContent = processedContent.replaceAll(fullMatch, imageContent);
        }

        // Process audio - matches [filename.mp3](path/to/audio.mp3)
        const audioRegex = /\[([^\]]+)\]\(([^)]+\.mp3)\)/g;
        const processedAudio = new Set<string>();

        for (const match of markdown.matchAll(audioRegex)) {
            const [fullMatch, _, audioPath] = match;
            
            // Skip if we've already processed this audio file
            if (processedAudio.has(audioPath)) {
                continue;
            }
            processedAudio.add(audioPath);

            const audioFilePath = path.join(BASE_DIR, audioPath);
            const audioContent = await this.processAudio(audioFilePath);
            // Replace all occurrences of this audio reference
            processedContent = processedContent.replaceAll(fullMatch, audioContent);
        }

        await fs.writeFile(path.join(BASE_DIR, 'article_processed.md'), processedContent, 'utf-8');
        return processedContent;
    }

    private async processImage(imagePath: string): Promise<string> {
        // Create cache file path by appending .txt to the image path
        const cacheFilePath = `${imagePath}.txt`;
        
        try {
            // Check if cache exists
            const cacheExists = await fs.access(cacheFilePath).then(() => true).catch(() => false);
            if (cacheExists) {
                console.log(`Loading cached OCR for ${imagePath}`);
                return fs.readFile(cacheFilePath, 'utf-8');
            }

            // If no cache, process the image
            console.log(`Processing image ${imagePath}`);
            const imageBuffer = await fs.readFile(imagePath);
            const completion = await this.openAIService.completion({
                messages: [
                    { role: 'system', content: OCR_IMAGE_PROMPT },
                    { role: 'user', content: [
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}` } },
                    ] }
                ]
            });
            const resp = (completion as ChatCompletion).choices[0].message.content;
            if (!resp) {
                throw new Error('No markdown content returned from OpenAI');
            }

            // Cache the result
            await fs.writeFile(cacheFilePath, resp, 'utf-8');
            return resp;
        } catch (error) {
            console.error(`Error processing image ${imagePath}:`, error);
            throw error;
        }
    }

    private async processAudio(audioPath: string): Promise<string> {
        // Create cache file path by appending .txt to the audio path
        const cacheFilePath = `${audioPath}.txt`;
        
        try {
            // Check if cache exists
            const cacheExists = await fs.access(cacheFilePath).then(() => true).catch(() => false);
            if (cacheExists) {
                console.log(`Loading cached transcription for ${audioPath}`);
                return fs.readFile(cacheFilePath, 'utf-8');
            }

            // If no cache, process the audio
            console.log(`Processing audio ${audioPath}`);
            const audioBuffer = await fs.readFile(audioPath);
            const transcription = await this.openAIService.transcribe(audioBuffer);

            // Cache the result
            await fs.writeFile(cacheFilePath, transcription, 'utf-8');
            return transcription;
        } catch (error) {
            console.error(`Error processing audio ${audioPath}:`, error);
            throw error;
        }
    }

    private generateChunkId(chunk: string): string {
        return crypto.createHash('md5').update(chunk).digest('hex');
    }

    private async embedChunks(): Promise<void> {
        for (const [chunkId, chunk] of this.chunks.entries()) {
            const embedding = await this.openAIService.createEmbedding(chunk);
            await this.vectorStore.add(embedding, chunkId);
        }
    }

    private async generateAnswers(questions: string[]): Promise<QuestionAnswer> {
        const answers: QuestionAnswer = {};

        for (const question of questions) {
            const [questionId, questionText] = question.split('=');
            const questionEmbedding = await this.openAIService.createEmbedding(questionText);
            const relevantChunks = await this.vectorStore.search(questionEmbedding, 3);

            const chunkContents = relevantChunks
                .map(result => this.getChunkContent(result.id))
                .filter(Boolean);

            const context = chunkContents.join('\n\n');
            const prompt = ANSWER_GENERATION_PROMPT
                .replace('{{context}}', context)
                .replace('{{question}}', questionText);

            const response = await this.openAIService.completion({
                messages: [
                    { role: 'system', content: prompt }
                ]
            });
            const answer = (response as ChatCompletion).choices[0].message.content;
            if (!answer) {
                throw new Error('No answer returned from OpenAI');
            }
            answers[questionId.trim()] = answer.trim();
        }

        return answers;
    }

    private splitIntoChunks(content: string): string[] {
        const chunks = content.split('\n\n').filter(Boolean);
        // Store chunks with their MD5 hashes
        chunks.forEach(chunk => {
            const chunkId = this.generateChunkId(chunk);
            this.chunks.set(chunkId, chunk);
        });
        
        return chunks;
    }

    private getChunkContent(chunkId: string): string {
        return this.chunks.get(chunkId) || '';
    }
}

// Main execution
async function main() {
    try {
        const processor = new ArxivProcessor();
        const answers = await processor.processArticle();
        
        const submitGateway = new TaskSubmitGateway({
            apiKey: process.env.PERSONAL_API_KEY || '',
            task: 'arxiv',
            endpoint: 'https://centrala.ag3nts.org/report'
        });

        await submitGateway.submit({
            task: 'arxiv',
            apikey: process.env.PERSONAL_API_KEY || '',
            answer: answers
        }, 'json');

    } catch (error) {
        console.error('Error processing article:', error);
        throw error;
    }
}

main();