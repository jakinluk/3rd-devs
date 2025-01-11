import { readFile } from 'fs/promises';
import { join } from 'path';
import { OpenAIService } from '../common/OpenAIService';
import { TaskSubmitGateway } from '../common/TaskSubmitGateway';
import OpenAI, {toFile} from 'openai';
import { readFileSync, writeFileSync } from 'fs';
import type { ChatCompletion } from 'openai/resources/chat/completions';

interface Sample {
  id: string;
  content: string;
  isValid?: boolean;
}

const apiKey = process.env.PERSONAL_API_KEY;
const task = "research";
const endpoint = "https://centrala.ag3nts.org/report";

const systemPrompt = "[code:MOD12Echo2] You are analyzing lab research results. Based on the sample, answer with VALID or INVALID.";

export class ResearchAnalyzer {
  private openAIService: OpenAIService;
  private submitGateway: TaskSubmitGateway;

  constructor() {
    this.openAIService = new OpenAIService();
    this.submitGateway = new TaskSubmitGateway({
      apiKey: apiKey!,
      task: task,
      endpoint: endpoint
    });
  }

  private async readSamples(filename: string): Promise<string[]> {
    const path = join(__dirname, 'lab_data', filename);
    const content = await readFile(path, 'utf-8');
    return content.split('\n').filter(line => line.trim());
  }

  private async prepareFinetuningData(): Promise<{ training: any[], validation: any[] }> {
    const correctSamples = await this.readSamples('correct.txt');
    const incorrectSamples = await this.readSamples('incorrect.txt');

    // Calculate validation set size (10% of each)
    const correctValidationCount = Math.ceil(correctSamples.length * 0.1);
    const incorrectValidationCount = Math.ceil(incorrectSamples.length * 0.1);

    // Shuffle and split correct samples
    const shuffledCorrect = [...correctSamples].sort(() => Math.random() - 0.5);
    const correctValidation = shuffledCorrect.slice(0, correctValidationCount);
    const correctTraining = shuffledCorrect.slice(correctValidationCount);

    // Shuffle and split incorrect samples
    const shuffledIncorrect = [...incorrectSamples].sort(() => Math.random() - 0.5);
    const incorrectValidation = shuffledIncorrect.slice(0, incorrectValidationCount);
    const incorrectTraining = shuffledIncorrect.slice(incorrectValidationCount);

    const createMessages = (sample: string, isValid: boolean) => ({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this sample: ${sample}` },
        { role: 'assistant', content: isValid ? 'VALID' : 'INVALID' }
      ]
    });

    return {
      training: [
        ...correctTraining.map(sample => createMessages(sample, true)),
        ...incorrectTraining.map(sample => createMessages(sample, false))
      ],
      validation: [
        ...correctValidation.map(sample => createMessages(sample, true)),
        ...incorrectValidation.map(sample => createMessages(sample, false))
      ]
    };
  }

  private async fineTuneModel(): Promise<string> {
    const openai = new OpenAI();
    const { training, validation } = await this.prepareFinetuningData();
    
    // Convert arrays to JSONL format
    const trainingJsonl = training.map(item => JSON.stringify(item)).join('\n');
    const validationJsonl = validation.map(item => JSON.stringify(item)).join('\n');
    
    // save to file
    writeFileSync(join(__dirname, 'training.jsonl'), trainingJsonl);
    writeFileSync(join(__dirname, 'validation.jsonl'), validationJsonl);
    
    // First, upload the training data file
    const trainingFile = await openai.files.create({
      file: await toFile(readFileSync(join(__dirname, 'training.jsonl'))),
      purpose: 'fine-tune'
    });

    const validationFile = await openai.files.create({
      file: await toFile(readFileSync(join(__dirname, 'validation.jsonl'))),
      purpose: 'fine-tune'
    });

    // Then use the file ID for fine-tuning
    const fineTunedModel = await new OpenAI().fineTuning.jobs.create({
      training_file: trainingFile.id,
      validation_file: validationFile.id,
      model: 'gpt-4o-mini-2024-07-18',
      suffix: 'research-validator'

    });

    console.log(fineTunedModel);
    writeFileSync(join(__dirname, 'fineTunedModel.json'), JSON.stringify(fineTunedModel));

    return fineTunedModel.id;
  }

  private extractId(sample: string): string {
    return sample.substring(0, 2);
  }

  private async validateSample(sample: string, modelId: string): Promise<boolean> {
    const response = await this.openAIService.completion({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this sample: ${sample}` }
      ]
    });

    return !!(response as ChatCompletion).choices[0]?.message?.content?.includes('VALID');
  }


  public async fineTune(): Promise<void> {
    try {
      // Fine-tune the model
      const fineTunedModelId = await this.fineTuneModel();
      console.log('fine tunning job created', fineTunedModelId);

    } catch (error) {
      console.error('Error during fine tune job creation:', error);
      throw error;
    }
  }

  public async analyze(fineTunedModelId: string): Promise<void> {
    try {

      // Validate samples
      const samplesToVerify = await this.readSamples('verify.txt');
      const validIds: string[] = [];

      for (const sample of samplesToVerify) {
        const isValid = await this.validateSample(sample, fineTunedModelId);
        if (isValid) {
          validIds.push(this.extractId(sample));
        }
      }

      // Submit results
      const result = validIds.join(',');
      await this.submitGateway.submit(result, 'json');
      console.log('Results submitted successfully');

    } catch (error) {
      console.error('Error during analysis:', error);
      throw error;
    }
  }
}

// Run the analysis
if (require.main === module) {
  const analyzer = new ResearchAnalyzer();
  analyzer.fineTune().catch(console.error);
//   analyzer.analyze("ftjob-20250111120000").catch(console.error);
}
