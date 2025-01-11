# Task
Analyze lab research results by comparing them with reference data to identify trustworthy samples and filter out falsified ones.

## Expected Answer Format
String containing comma-separated two-digit IDs of valid research samples
```
"12,34,56"
```

## Instructions
1. use the data from lab_data/correct.txt and lab_data/incorrect.txt to fine-tune gpt-4o-mini model
2. use the fine-tuned model to classify the data from lab_data/verify.txt
3. submit the answer to /report endpoint with task name 'research' using TaskSubmitGateway class from _lessons/common/TaskSubmitGateway.ts

## Important Notes before submission
1. Each sample line starts with a two-digit identifier
2. Only include IDs from samples determined to be valid
5. The order of IDs in the final answer doesn't matter
