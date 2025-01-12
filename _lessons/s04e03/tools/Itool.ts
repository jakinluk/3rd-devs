export interface Itool<Input, Output> {
  name: string;
  description: string;
  inputDescription: string;
  outputDescription: string;
  process(input: Input): Promise<Output>;
}
