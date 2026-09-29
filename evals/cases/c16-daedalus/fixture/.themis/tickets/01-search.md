# 01 Search notes
Blocked by: none
## Build
GET /notes?q=<term> returns only notes whose text contains the term, case-insensitive. Without q, all notes are returned as today.
## Acceptance criteria
- [ ] Searching "milk" returns "Buy MILK" but not "Call mom"
- [ ] GET /notes without q still returns every note
- [ ] The test suite passes
## Out of scope
Pagination, ranking.
