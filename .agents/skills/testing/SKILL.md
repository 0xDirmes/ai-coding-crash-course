---
name: testing
description: Writing or fixing Vitest tests for services and lib modules. Use when adding a `*.test.ts` file, when a test touches the database, or when a test unexpectedly reads or writes `data.db`.
---

# Testing

Services import the shared `db` singleton rather than taking a handle, so a test swaps the database by mocking `~/db`. `createTestDb` and `seedBaseData` in `app/test/setup.ts` supply a fresh in-memory database built from the real migrations.

## Mocking the database

Mock `~/db` with a **getter**, so the binding stays live as `beforeEach` replaces `testDb`, and import the module under test **after** the mock:

```ts
import { createTestDb, seedBaseData } from "~/test/setup";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

import { getCourseById } from "~/services/courseService";

beforeEach(() => {
  testDb = createTestDb();
  base = seedBaseData(testDb);
});
```

The import order is load-bearing. With the service import above the mock, the service silently captures the real `data.db`, and tests run — and may pass — against the wrong database. `app/services/courseService.test.ts` is a working reference.

Done when the new tests pass under `npx vitest run <file>` and `data.db` is untouched by the run.
