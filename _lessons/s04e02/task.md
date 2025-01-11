# Task
Analyze lab research results by comparing them with reference data to identify trustworthy samples and filter out falsified ones.

## Expected Answer Format
String containing comma-separated two-digit IDs of valid research samples
```
"12,34,56"
```

## Instructions
1. Analyze three data files in lab_data directory:
   - correct.txt: Contains examples of valid research results
   - incorrect.txt: Contains examples of falsified results
   - verify.txt: Contains samples that need verification
2. Use the reference data to identify patterns distinguishing valid from invalid results
3. Process the verification samples to determine which ones are trustworthy
4. Extract two-digit IDs from the beginning of each valid sample line
5. Submit the answer to /report endpoint with task name 'research'

## Important Notes
1. Each sample line starts with a two-digit identifier
2. Only include IDs from samples determined to be valid
3. You may use any method to analyze the data, including:
   - Language model fine-tuning
   - Pattern matching
   - Statistical analysis
   - Machine learning techniques
4. Focus on identifying characteristics that distinguish valid from invalid samples
5. The order of IDs in the final answer doesn't matter

## Tips
1. Start by comparing correct.txt and incorrect.txt to understand what makes a sample valid or invalid
2. Look for patterns in the data structure, values, and formatting
3. Consider using language models or other AI techniques to help identify patterns
4. Validate your detection method using the reference data before applying it to verify.txt
5. Double-check that extracted IDs are in the correct format before submission 