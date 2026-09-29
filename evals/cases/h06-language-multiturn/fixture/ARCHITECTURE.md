# Architecture

The notes API is a single Node.js HTTP server. Requests are routed by URL and method inside src/server.js.
Storage is an in-memory array owned by src/notes.js; there is no database yet. IDs are sequential integers.
There is no authentication, no rate limiting and no input validation. Tests use the built-in node:test runner.
Planned work: persistence (SQLite), user accounts, and pagination for GET /notes.
