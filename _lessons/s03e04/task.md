# Task
Find Barbara Zawadzka by querying two API endpoints and analyzing a text file to discover her location.

## Expected Answer Format
String containing the city name where Barbara is located
```
"CITY_NAME"
```

## Instructions
1. Download and analyze the note about Barbara from: https://centrala.ag3nts.org/dane/barbara.txt
2. Use two API endpoints to gather information:
   - People search: https://centrala.ag3nts.org/people
   - Places search: https://centrala.ag3nts.org/places
3. Extract names and places from the note
4. Query both APIs iteratively to discover connections between people and places
5. Find the final location of Barbara
6. Submit the answer to /report endpoint

## API Format
Both APIs accept JSON requests in the following format:
```json
{
  "apikey": "YOUR_KEY",
  "query": "NAME_OR_CITY"
}
```

## Important Notes
1. Use nominative case for names when querying the API
2. Remove Polish characters from city names (e.g., "SLASK" instead of "ŚLĄSK")
3. The APIs might return incomplete data - work with what you receive
4. Avoid infinite loops when querying the APIs
5. There might be a hidden flag 🚩 along the way

## Tips
1. Start by analyzing the text file to extract initial names and places
2. Create a graph or map of connections between people and places. Update it as you discover new connections
3. Query new names and places as you discover them
4. Keep track of already queried items to avoid duplicates
5. Look for patterns in the connections that might lead to Barbara's location
