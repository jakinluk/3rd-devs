
# Task
Get the answer to the question: "Which active datacenters (DC_ID) are managed by employees on leave (is_active=0)?"

## Expected Answer Format
Json array of DC_IDs
```
[DC_ID1, DC_ID2, DC_ID3]
```

## Instructions
1. Recognize the database structure and the relationships between tables by running the `show tables` and `show create table TABLE_NAME` queries
2. build a context from the results to build a final sql query that will give the answer
3. pass the context to the prompt responsible for building the final sql query
4. pass the final sql query to the `DBGateway` to get the answer.
5. pass the sql answer to the prompt responsible for formatting the answer to the expected format

## Tips
1. Use `DBGateway` from `_lessons/s03e03/DBGateway.ts` to query the database.
2. As a starting point use the following SQL queries (the responses will help you to build the final SQL query)
    - `show tables` - shows all tables in the database
    - `show create table TABLE_NAME` - shows how a specific table is structured
3. Employees on leave are those whose `is_active` is 0
