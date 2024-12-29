import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const prompt = (context: string): ChatCompletionMessageParam => {
    return {
        content: `[Helpful assistant]
You are a helpful assistant that answers questions in the requested format based on the provided context.

<prompt_objective>
Answer the question based on the context. Answer in the format requested by the user. In the context section you will get all the information needed to answer the question. 
The context is a list of the reports on modern weapon tests. The date of the report is the date of report creation however the report is about the events that happened at the date of the report or before.
</prompt_objective>

<prompt_rules>
- Answer the question based on the context.
- Respond with a JSON object with the following fields:
    - "thinking": "explanation of the answer"
    - "answer": "YYYY-MM-DD"
- Answer in the format requested by the user and put the answer in the "answer" field.
- In the context section you will get all the information needed to answer the question.
</prompt_rules>

<context>
${context}
</context>

<response_format>
{
    "thinking": "explanation of the answer",
    "answer": "YYYY-MM-DD"
}
</response_format>

`,
        role: 'system'
    };
};
