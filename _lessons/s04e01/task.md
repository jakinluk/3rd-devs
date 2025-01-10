# Task
Create an AI agent that processes damaged photos to identify Barbara and create her detailed description.

## Expected Answer Format
A detailed description in Polish language that includes all identifiable features of Barbara:
```
"Szczegółowy rysopis Barbary zawierający wszystkie zauważone cechy charakterystyczne..."
```

## Agent Tools
1. `plan`: Strategic planning tool
   - Input: Current state of photos and previous actions
   - Output: Array of next actions to perform
   - Purpose: Determines the sequence of operations needed in current iteration

2. `fetch-photo`: Resource retrieval tool
   - Input: URL or resource identifier
   - Output: Retrieved photo(s)
   - Purpose: Downloads photos from provided URLs

3. `fix-photo`: Photo processing tool
   - Input: Photo or array of photos
   - Output: Analysis and recommended fixes
   - Commands:
     - `REPAIR FILENAME` - fixes noise and glitches
     - `DARKEN FILENAME` - darkens the photo
     - `BRIGHTEN FILENAME` - brightens the photo
   - Purpose: Analyzes image quality and suggests appropriate fixes

4. `describe`: Photo analysis tool
   - Input: Photo or array of photos
   - Output: Detailed description of photo contents
   - Purpose: Identifies and describes elements in photos

5. `answer`: Task completion tool
   - Input: Accumulated photo descriptions and analysis
   - Output: Final description of Barbara
   - Purpose: Generates final answer when sufficient information is gathered

## Workflow
1. Agent Iterative Process:
   - Use `plan` to determine next actions
   - `fetch-photo` to retrieve images
   - `fix-photo` to analyze and repair images as needed
   - `describe` to understand photo contents
   - `answer` to generate final response based on the gathered during the process information
   - Repeat until all photos are properly processed

2. Final Submission (use TaskSubmitGateway):

## Tips
1. Use smaller image versions (-small suffix) for faster processing
2. Each photo might need multiple fixing iterations
3. Not all photos may contain Barbara
4. Track which photos have been processed and their current state
5. Maintain history of applied fixes to avoid repetition

## Success Criteria
- All photos properly processed and analyzed
- Barbara identified in photos
- Detailed description generated in Polish
- Central system confirms description accuracy