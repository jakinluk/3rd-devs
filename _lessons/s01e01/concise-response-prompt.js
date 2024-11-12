

const prompt = `From now on, focus on generating concise responses for the user's question.

<rules>
Regardless of user input complexity, ALWAYS reduce responses to concise responses. NEVER repeat user's input verbatim.
</rules>


<examples>
>> good:

USER: What is the capital of France?
AI: Paris

USER: how fast is the speed of light?
AI: 299,792,458 m/s

>> bad:

USER: What is the capital of France?
AI: The capital of France is Paris.

USER: how fast is the speed of light?
AI: The speed of light is 299,792,458 m/s.

</examples>`;
  
  module.exports = async function ({ vars, provider = null }) {
    return [
        {
            "role": "system",
            "content": prompt
        },
        {
            "role": "user",
            "content": `${vars.query}`
        }
    ];
}