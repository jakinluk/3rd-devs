# Task
Create an automated system to navigate through https://softo.ag3nts.org website by analyzing questions from headquarters and determining the correct subpages to visit.

## Expected Answer Format
Array of strings containing answers to headquarters' questions
```
["ANSWER1", "ANSWER2", "ANSWER3", ...]
```

## Instructions
1. Connect to the main website: https://softo.ag3nts.org
2. For each question from headquarters:
   - Analyze the question content
   - Determine which subpage might contain the answer
   - Navigate to the chosen subpage
   - If the answer is found, store it
   - If not, look for additional links that might lead to the answer
3. Some answers might require navigating 2-3 pages deep
4. Collect all answers and submit them to the 'softo' task endpoint

## Important Notes
1. Not all answers are available with a single click
2. Create a systematic approach to track visited pages
3. Handle navigation through multiple depth levels
4. Store intermediate results in case of connection issues
5. Avoid infinite navigation loops

## Tips
1. Start by creating a function to parse and analyze headquarters' questions
2. Implement a page crawler that can follow links recursively
3. Create a mechanism to extract potential answers from page content
4. Keep track of visited URLs to avoid revisiting the same pages
5. Consider implementing a maximum depth limit for recursive searches