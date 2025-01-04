import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const extractNameAndPlacesPrompt = (text: string): ChatCompletionMessageParam => {
    return {
        content: `[Name and places extraction]
<prompt_objective>
Extract names of people and places from the given text. Return them in JSON format: {\"names\": [\"name1\", \"name2\"], \"places\": [\"place1\", \"place2\"]}
</prompt_objective>

<prompt_rules>
- The names should be the first name of the person in nominative form in Polish.
- The places should be the city name in nominative form in Polish.
- if ther are no names or places, return an empty arrays for both.
- Remove duplicates from the arrays before returning them.
- Polish diacritics should be replaced with English equivalents for the names and places.
</prompt_rules>

<example>

User:
Jana nie było w Łodzi. Ale Anna odwiedziła Kraków.

AI:
{
    "names": ["Jan", "Anna"],
    "places": ["Lodz", "Krakow"]
}
</example>

<context>
        ${text}
        </context>`,
        role: 'system'
    };
}

export const findMostRelevantPlaceToFindBarbaraPrompt = (context: string, placesAlreadyChecked: string[]): ChatCompletionMessageParam => {
    return {
        content: `[Investigator and Data analysis]
As part of the investigation, you will be given a list of reports or notes (see context section below) about Barbara and other related people and places. 
You will also be given a list of places that have already been checked (see places_already_checked section below).
<prompt_objective>
Find the most likely place to find Barbara.
</prompt_objective>

<prompt_rules>
- You should only consider places that have not been checked yet.
- respond in JSON format: {"thinking": "justification of the choice", "city": "city name"}
- You should provide a justification for your choice in the "thinking" property.
- You should provide the name of the city in the "city" property.
</prompt_rules>

<context>
${context}
</context>

<tips>
- analyze Barbara's connections to people and cities and try to estimate the probability of finding her in a given place. Name the most probable city.
- start with the cities Barbara was seen in.
</tips>

<places_already_checked>
${placesAlreadyChecked.join(", ")}
</places_already_checked>


<response_format>
{
    "thinking": "justification of the choice",
    "city": "city name"
}
</response_format>`,
        role: 'system'
    };
};
