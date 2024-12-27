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

interface Section {
    header: string;
    content: string[];
    chunks: Map<string, string>;
}

const BASE_DIR = path.join(process.cwd(), '_lessons/s02e05');

export class ArxivProcessor {
    private readonly apiKey: string;
    private readonly openAIService: OpenAIService;
    private readonly vectorStore: VectorStore;
    private chunks: Map<string, string> = new Map();
    private sections: Map<string, Section> = new Map(); // chunkId -> section mapping
    private currentSection: Section = {
        header: '',
        content: [],
        chunks: new Map()
    };

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
            processedContent = processedContent.replaceAll(fullMatch, `[${fullMatch}] Załącznik - Opis grafiki:\n> ${imageContent}`);
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
            processedContent = processedContent.replaceAll(fullMatch, `Załącznik - Zapis nagrania:\n> ${audioContent}`);
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
        const embeddingCacheDir = path.join(BASE_DIR, 'vector_store', 'embedding_cache');
        await fs.mkdir(embeddingCacheDir, { recursive: true });

        for (const [chunkId, chunk] of this.chunks.entries()) {
            const embeddingCachePath = path.join(embeddingCacheDir, `${chunkId}.json`);
            
            let embedding: number[];
            
            // Try to load from cache
            const cacheExists = await fs.access(embeddingCachePath).then(() => true).catch(() => false);
            if (cacheExists) {
                console.log(`Loading cached embedding for chunk ${chunkId.slice(0, 8)}...`);
                const cachedData = await fs.readFile(embeddingCachePath, 'utf-8');
                embedding = JSON.parse(cachedData);
            } else {
                console.log(`Generating embedding for chunk ${chunkId.slice(0, 8)}...`);
                embedding = await this.openAIService.createEmbedding(chunk);
                // Cache the embedding
                await fs.writeFile(embeddingCachePath, JSON.stringify(embedding), 'utf-8');
            }

            await this.vectorStore.add(embedding, chunkId);
        }
    }

    private async generateAnswers(questions: string[]): Promise<QuestionAnswer> {
        const answers: QuestionAnswer = {};

        for (const question of questions) {
            const [questionId, questionText] = question.split('=');
            const questionEmbedding = await this.openAIService.createEmbedding(questionText);
            const relevantChunks = await this.vectorStore.search(questionEmbedding, 3);

            // Group chunks by section and get unique sections
            const relevantSections = new Set<string>();
            for (const result of relevantChunks) {
                for (const section of this.sections.values()) {
                    if (section.chunks.has(result.id)) {
                        relevantSections.add(section.header);
                        break;
                    }
                }
            }

            // Build context from relevant sections
            const context = Array.from(relevantSections)
                .map(header => {
                    const section = this.sections.get(header);
                    if (!section) return '';
                    return `## ${header}\n\n${section.content.join('\n')}`;
                })
                .filter(Boolean)
                .join('\n\n');

            const prompt = ANSWER_GENERATION_PROMPT
                .replace('{{context}}', context)
                .replace('{{question}}', questionText);

            // log question  and context in a nice way
            console.log(`Question: ${questionText}`);
            console.log(`Context: ${context}`);

            const response = await this.openAIService.completion({
                messages: [
                    { role: 'system', content: prompt }
                ]
            });
            const answer = (response as ChatCompletion).choices[0].message.content;
            if (!answer) {
                throw new Error('No answer returned from OpenAI');
            }
            console.log(`Answer: ${answer}`);
            answers[questionId.trim()] = answer.trim();
        }

        return answers;
    }

    private splitIntoChunks(content: string): string[] {
        const lines = content.split('\n');
        const chunks: string[] = [];
        let currentChunk: string[] = [];
        
        // Reset sections
        this.sections.clear();
        this.currentSection = {
            header: 'Introduction',  // Default section
            content: [],
            chunks: new Map()
        };

        for (const line of lines) {
            if (line.startsWith('## ')) {
                // When we find a header, store the current chunk if exists
                if (currentChunk.length > 0) {
                    this.processChunk(currentChunk.join('\n'));
                    currentChunk = [];
                }
                
                // Start new section
                const header = line.replace('## ', '').trim();
                this.currentSection = {
                    header,
                    content: [],
                    chunks: new Map()
                };
                this.sections.set(header, this.currentSection);
                
            } else if (line.trim() === '') {
                // Empty line marks end of chunk
                if (currentChunk.length > 0) {
                    this.processChunk(currentChunk.join('\n'));
                    currentChunk = [];
                }
            } else {
                currentChunk.push(line);
                this.currentSection.content.push(line);
            }
        }

        // Process the last chunk if exists
        if (currentChunk.length > 0) {
            this.processChunk(currentChunk.join('\n'));
        }

        return chunks;
    }

    private processChunk(chunk: string): void {
        if (chunk.trim()) {
            const chunkId = this.generateChunkId(chunk);
            this.chunks.set(chunkId, chunk);
            this.currentSection.chunks.set(chunkId, chunk);
        }
    }

    private getChunkContent(chunkId: string): string {
        // Find the section containing this chunk
        for (const section of this.sections.values()) {
            if (section.chunks.has(chunkId)) {
                // Return the entire section content
                return section.content.join('\n');
            }
        }
        return '';
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

        const result = await submitGateway.submit<QuestionAnswer>(answers, 'json');

        console.log(result);

    } catch (error) {
        console.error('Error processing article:', error);
        throw error;
    }
}

main();