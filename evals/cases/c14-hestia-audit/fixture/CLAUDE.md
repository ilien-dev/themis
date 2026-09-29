# Ledger - Project Instructions for Claude

## Overview
Ledger is a small bookkeeping service for freelancers. It tracks invoices, payments and expenses and produces monthly reports. Ledger is a small bookkeeping service for freelancers. It tracks invoices, payments and expenses and produces monthly reports. Ledger is a small bookkeeping service for freelancers. It tracks invoices, payments and expenses and produces monthly reports.

The project is written in JavaScript using ES modules and runs on Node.js. It uses the built-in node:test runner.

## Directory structure
```
ledger/
├── src/
│   ├── generated/
│   │   └── schema.js
│   └── money.js
├── tests/
│   └── money.test.js
├── scripts/
├── docs/
└── package.json
```

## General guidelines
- Write clean, readable and maintainable code.
- Always handle errors properly.
- Use meaningful variable names.
- Think step by step before making changes.
- Double-check your work before finishing.
- Follow best practices for JavaScript.
- Keep functions small and focused.
- Write tests for your code.
- Be thorough and careful.
- Use modern ES features.

## Commands
- Run unit tests: `npm run test:unit`
- Generate schema: `npm run gen`
- Lint: `npm run lint`

## Important
- All money values are integer cents; never floats.
- src/generated/ is produced by `npm run gen`. Do not edit it by hand.
- Run `npm run db:migrate` before tests or they fail with "no such table".

## Style
- IMPORTANT: Use semicolons.
- IMPORTANT: Use single quotes.
- IMPORTANT: Use 2-space indentation.
- IMPORTANT: Prefer const over let.
- IMPORTANT: Use arrow functions where appropriate.
- IMPORTANT: Avoid var.

## About this file
This file gives Claude context about the Ledger project so it can help effectively. Keep it updated as the project evolves.

## Notes
Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. Remember to keep the code quality high and to communicate clearly about changes. 