import express from 'express';
import type { Request, Response } from 'express';
import { OpenAIService } from '../common/OpenAIService';
import { trackPositionPrompt } from './prompt';

interface InstructionRequest {
  instruction: string;
}

interface PositionResponse {
  thinking: string;
  pos: string;
}

const app = express();
const port = process.env.PORT || 3000;
const openAIService = new OpenAIService({ tracing: true , useOpenRouter: true});

app.use(express.json());

const mapDesc = {
    "0,0": "start",
    "0,1": "łąka",
    "0,2": "samotne drzewo",
    "0,3": "zabudowania",
    "1,0": "łąka",
    "1,1": "wiatrak",
    "1,2": "łąka",
    "1,3": "łąka",
    "2,0": "łąka",
    "2,1": "łąka",
    "2,2": "samptne skały",
    "2,3": "drzewa",
    "3,0": "góry",
    "3,1": "zbocze gór",
    "3,2": "auto",
    "3,3": "jaskinia",
}

app.post('/', async (req: Request<{}, {}, InstructionRequest>, res: Response) => {
  const { instruction } = req.body;
  
  if (!instruction || typeof instruction !== 'string') {
    return res.status(400).json({
      error: 'Invalid request body. Must include "instruction" as string'
    });
  }

  try {
    const completion = await openAIService.completion({
      messages: [
        { role: 'system', content: trackPositionPrompt },
        { role: 'user', content: instruction }
      ],
      model: 'gpt-4o',
      jsonMode: true
    });

    if (!openAIService.isStreamResponse(completion)) {
      const response = openAIService.parseJsonResponse<PositionResponse>(completion);
      console.log("response", response);
      res.json(
        { 
            description: mapDesc[response.pos as keyof typeof mapDesc], 
            thinking: response.thinking }  );
    }
  } catch (error) {
    console.error('Error processing instruction:', error);
    res.status(500).json({ error: 'Failed to process instruction' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;
