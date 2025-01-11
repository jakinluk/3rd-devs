export interface IAgent {
  process(input: string): Promise<string>;
}