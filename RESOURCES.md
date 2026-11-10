# Cadence Codebase Resources

## Knowledge

- [The repo itself](./README.md): `app/routes.ts`, `app/db/schema.ts`, `app/services/*`
  The primary source. Use for: every claim about how Cadence works. Cite file paths.
- [React Router docs: Route Module](https://reactrouter.com/start/framework/route-module)
  Official reference for `loader`, `action`, `meta` and the default component export. Use for: what runs where (server and client) and in what order. Note: the repo pins `react-router` 8.3.0; check version-specific behavior against the docs.
- [React Router docs: Actions](https://reactrouter.com/start/framework/actions)
  Mutations, `<Form>` and `useFetcher`, and revalidation after an action. Use for: any write-path feature.
- [Drizzle ORM: SQLite connection (better-sqlite3)](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)
  Official driver setup. Use for: how `app/db/index.ts` connects. (The Drizzle "get started" guide uses libsql; this repo uses better-sqlite3, which is synchronous, so queries end in `.get()` / `.all()` / `.run()`.)
- [Drizzle ORM: Transactions](https://orm.drizzle.team/docs/transactions)
  Use for: making multi-write money flows atomic.
- [Zod docs](https://zod.dev)
  Use for: the `parseFormData` / `parseParams` validation pattern (repo uses Zod 3).
- [AI Coding Crash Course](https://www.aihero.dev/workshops/ai-coding-crash-course)
  The course this repo was built for. Use for: context on which features the course expects you to build.

## Wisdom (Communities)

- [React Router GitHub Discussions](https://github.com/remix-run/react-router/discussions)
  Use for: loader/action design questions.
- [Drizzle Discord](https://driz.link/discord)
  Use for: schema, migration and query questions.
- Your fintech team's code review. The most relevant place to test judgment on money-path code.

## Gaps
- No primary source for the PPP design decisions (why these tiers, why the country lock). Treat `app/lib/ppp.ts` as the spec.
