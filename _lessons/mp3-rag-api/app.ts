import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { OpenAIService } from '../common/OpenAIService';
import { AssistantService } from './AssistantService';
import { LangfuseService } from '../common/LangfuseService';
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import multer from 'multer';
import cors from 'cors';
import { Readable } from 'stream';
import { ReadableStream as WebReadableStream } from 'stream/web';

const app = express();
const port = 3000;
// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB in bytes
  }
});

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:5173', // Allow requests from this origin
    methods: ['GET', 'POST'],        // Allowed HTTP methods
    credentials: true,               // Allow credentials if needed
}));

const langfuseService = new LangfuseService();
const openaiService = new OpenAIService();
const assistantService = new AssistantService(openaiService, langfuseService);

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
    const audioFile = req.file;
    if (!audioFile) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
        // Pass the file buffer to the transcription service
        const transcription = await openaiService.transcribeGroq(audioFile.buffer);
        return res.json({ transcription });
    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: 'An error occurred during transcription' });
    }
});

app.post('/api/chat', async (req, res) => {
  let { messages, conversation_id = uuidv4() } = req.body;

  const systemMessage: ChatCompletionMessageParam = {
    role: 'system',
    content: `<prompt_objective>
You are a skilled investigator with exceptional analytical abilities, pattern recognition skills, and adaptable thinking approaches. Your role is to analyze data provided by your superior, make connections, and help solve investigations through multi-level thinking and casual but insightful communication.
</prompt_objective>

<prompt_rules>
- ALWAYS maintain a casual, friendly communication style with your superior ("boss", "mate")
- START each response with a brief greeting and acknowledgment
- ANALYZE data methodically while remaining open to different thinking approaches
- CLEARLY distinguish between facts, logical deductions, and speculations
- ADAPT your thinking approach immediately when requested
- ASK clarifying questions when needed
- EXPLAIN your logical connections and thought process
- NEVER invent data or ignore contradicting evidence
- MARK assumptions explicitly when making them
- ORGANIZE insights in clear, digestible segments
</prompt_rules>

<prompt_examples>
Superior: "We've got unusual patterns in our Q3 sales. Revenue is up 20%, but customer satisfaction dropped 15%. Here's the data..."

Investigator: "Hey boss! Interesting puzzle we've got here. Quick check - do we have any details on which product lines saw the biggest revenue jumps? At first glance, I'm seeing a potential connection between higher sales and reduced customer satisfaction that might point to quality control issues. Let me break this down..."

Superior: "Can you look at this from a supply chain perspective instead?"

Investigator: "Sure thing! Switching to supply chain analysis now. If we look at our delivery timelines during Q3..."

Superior: "Here's some incomplete data about a security breach. We only have server logs and building access records."

Investigator: "Hey mate! Got the logs here. Before I dive in - any specific time frame we should focus on? I'm already noticing some unusual patterns in the access records that might connect to the server activity..."
</prompt_examples>

You're now ready to start investigating. You will maintain this investigative persona throughout the conversation, adjusting your analytical approach as requested while keeping communication casual but professional. Remember to think across multiple levels and clearly explain your logical connections.`,
  };
  const trace = langfuseService.createTrace({ id: uuidv4(), name: (messages.at(-1)?.content || '')
      .slice(0, 45), sessionId: conversation_id, userId: 'Lukasz' });

  try {
    const answer = await assistantService.answer({ messages: [systemMessage, ...messages] }, trace);

    await langfuseService.finalizeTrace(trace, messages, answer.choices[0].message);
    await langfuseService.flushAsync();
    return res.json({...answer, conversation_id});
  } catch (error) {
    await langfuseService.finalizeTrace(trace, req.body, { error: 'An error occurred while processing your request' });
    console.error('Error in chat processing:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

app.post('/api/speak', async (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'No text provided' });
    }
    try {
        const audioStream = await openaiService.speak(text);
        if (!audioStream) {
            return res.status(500).json({ error: 'No audio stream returned' });
        }

        const nodeReadable = Readable.fromWeb(audioStream as unknown as WebReadableStream);

        res.setHeader('Content-Type', 'audio/mpeg');
        nodeReadable.pipe(res);
    } catch (error) {
        console.error('Speak API error:', error);
        res.status(500).json({ error: 'An error occurred during speech synthesis' });
    }
});


app.post('/api/speakEleven', async (req, res) => {
  try {
    const { text } = req.body;
    const audioGenerator = await openaiService.speakEleven(text);

    if (!audioGenerator) {
      return res.status(500).json({ error: 'No audio stream returned' });
    }

    res.set('Content-Type', 'audio/mpeg');

    // Convert the AsyncGenerator to a Node.js Readable stream
    const nodeStream = Readable.fromWeb(audioGenerator as unknown as WebReadableStream);

    // Pipe the stream to the response
    nodeStream.pipe(res);
  } catch (error) {
    console.error('Speak API error:', error);
    res.status(500).json({ error: 'Speech generation failed' });
  }
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));

process.on('SIGINT', async () => {
  await langfuseService.shutdownAsync();
  process.exit(0);
});