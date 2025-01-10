export const answerPrompt = (context: string, query: string) => `You are a helpful assistant.

<objective>
Answer the query based on the context.
</objective>

<context>
${context || "No analysis results available"}
</context>

<rules>
- respond in JSON format
- Write in formal Polish
- Use output format below
</rules>

<output_format>
{
  "thinking": "your thoughts on how to answer the query",
  "answer": "Answer to the query in Polish"
}
</output_format> 

<query>
${query}
</query>
`;