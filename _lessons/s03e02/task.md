
# Task
Index the reports on modern weapon tests and answer the question: "On which day was the weapon prototype stolen?"

## Instructions

1. In the `files/` folder, you'll find reports on modern weapon tests.
2. Index these reports using embeddings in qdrant vector database under the collection name `aidevs` (use `QuadrantVectorService` from `_lessons/common/QuadrantVectorService.ts`).
    - add metadata: `title`, `source`, `uuid`, `report_date`
    - source will be the file location (e.g. `files/report_1.txt`)
    - report_date will be the date of the report (e.g. `2024-01-01`) taken from the filename (e.g. `2024-01-01_report.txt`)
    - for simplicity put value from source into the uuid field
    - title will be the first line of the report (e.g. `Report on the new weapon prototype`)
3. Answer the question: "On which day was the weapon prototype stolen?" by:
    - creating an embedding for the question: "In which day's report is there a mention of the weapon prototype theft?"
    - querying the database with the embedding for the related to the query documents
    - rank the documents by relevance to the query (use prompt like the one in rerank example)
    - build context from the most relevant document
    - answer the question based on the context
    - sending the date in the "answer" field to the headquarters (/report) in YYYY-MM-DD format for the "vectors" task

## Expected Answer Format

YYYY-MM-DD

## Tips

1. Ensure that metadata stored with vectors includes the date of the described event (you may include more details at your discretion).

2. Create an embedding for the question: "In which day's report is there a mention of the weapon prototype theft?" and query your database with it, setting the limit of returned records to 1.

3. If the database doesn't return appropriate results, enrich the reports with relevant metadata as we did yesterday.

4. Check the date returned by the database for the above query and send it in the "answer" field to the headquarters (/report) in YYYY-MM-DD format for the "vectors" task.

## Question to Answer

"On which day was the weapon prototype stolen?"

## related examples
semantic/
rerank/
embeding/
