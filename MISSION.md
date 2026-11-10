# Mission: The Cadence codebase

## Why
Build features for Cadence (this repo's course platform) with confidence, quickly and without breaking money-handling code. Jordi works at a fintech company and is comfortable with TypeScript, so the goal is fluency in *this* codebase's patterns, not general web development.

## Success looks like
- Given any URL, trace it to its route module, loader/action, services and tables without searching blindly
- Explain the purchase flow end to end: PPP pricing, purchases, enrollments, team coupons
- Add a feature from `_internal/feature-ideas.md` that follows project conventions (Zod-validated actions, positional-param services, Drizzle migration, in-memory-DB tests)
- Spot the risky parts of the money paths, such as missing transactions and trusting client input

## Constraints
- Already strong in TypeScript: skip language basics
- Short lessons; hands-on in the real repo beats abstract examples

## Out of scope
- General React/CSS/Tailwind styling
- The `request-logger/` subproject (separate tool, not the product)
- Claude Code workflow (the course itself covers it)
