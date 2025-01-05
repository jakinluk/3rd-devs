# Task
Find the shortest path from Rafał to Barbara using the connections data from MySQL database.

## Expected Answer Format
Comma-separated string of names representing the path:
```
"Rafał, Person2, Person3, ..., Barbara"
```

## Instructions
1. Retrieve data from MySQL database:
   - Get users from `users` table (contains names and IDs)
   - Get connections from `connections` table (contains source_id and target_id mappings)
2. Build a graph database structure (using Neo4j) where:
   - Nodes represent people
   - Edges represent "knows" relationships (one-directional)
3. Query the graph database to find the shortest path from Rafał to Barbara
4. Format the result as a comma-separated string of names

## Tips
1. Use `DBGateway` from `_lessons/s03e05/DBGateway.ts` to query the MySQL database
2. Use `Neo4jService` from `_lessons/common/Neo4jService.ts` for graph database operations
3. The connections are one-directional (if A knows B, it doesn't mean B knows A)
4. Names in the database are unique
5. You don't need to query MySQL database in real-time - you can cache the data since it doesn't change

## Table structure

"Create Table": "CREATE TABLE `users` (\n  `id` int(11) NOT NULL AUTO_INCREMENT,\n  `username` varchar(20) DEFAULT NULL,\n  `access_level` varchar(20) DEFAULT 'user',\n  `is_active` int(11) DEFAULT 1,\n  `lastlog` date DEFAULT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
```
users
  id: int
  username: string
  access_level: string
  is_active: int
  lastlog: date

connections
  user1_id: int
  user2_id: int
```

## Required SQL Queries
1. To get users:
```sql
SELECT * FROM users;
```
2. To get connections:
```sql
SELECT * FROM connections;
```
