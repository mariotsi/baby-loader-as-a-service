# One test runner, Vitest, runs every test below the browser

Every test that is not a Playwright E2E test runs under Vitest, in one of three projects declared in `vitest.config.ts`. `unit` runs every `*.test.ts` under `src` and every `*.test.mjs` under `scripts` in Node, where the tests that cross the persistence seam start an in-memory D1 through wrangler (`src/db/testDb.ts`). `components` runs every `*.test.tsx` under `src` in jsdom with React Testing Library, for what a component or a hook does when someone uses it. `storybook` renders every story in Chromium and runs axe on it. `npm test` runs `unit` and `components` together; `npm run test:storybook` runs `storybook` as its own script and its own CI job, since it alone needs a browser.

Node's built-in runner (`node --test` with `node:assert/strict`) needs no dependency and runs TypeScript by stripping types, which is enough for pure modules and for the D1 tests. It has no DOM and no module transform, so a hook or a component cannot be tested in it without adding jsdom, a JSX transform and a loader for CSS Modules and the `@/` alias by hand. Vitest already runs the stories, so it is installed, configured and known; keeping both would mean two assertion vocabularies, two ways to mock and two sets of flags for one kind of work. One runner gives one way to write a test and one command that says whether the code below the browser works.

Tests import `test`, `beforeAll`, `afterAll` and `expect` from `vitest`. `toBe` and `toStrictEqual` carry the strictness of `assert.equal` and `assert.deepEqual` from `node:assert/strict`: an `undefined` property and a different prototype are differences. Where a check must also narrow a type for the lines after it, as in `assert(parsed.ok)` before reading `parsed.value`, the test uses Vitest's `assert`, because `expect` cannot narrow.

## Consequences

- No file imports `node:test` or `node:assert`, and no script runs `node --test`: a test written for Node's runner has nothing that runs it as one.
- Each test file runs in its own worker with its own module graph, so a file that calls `startTestDb` has a D1 no other file sees, and files run in parallel. Tests inside a file run in order and share that database.
- The `unit` project gives each test and each hook 120 seconds, the room workerd needs to start and apply the migrations on a loaded machine.
- A file's extension picks its project: `.test.ts` runs in Node with no DOM, `.test.tsx` runs in jsdom. A hook test is a `.test.tsx` even when it holds no JSX.
- jsdom is not a browser: it has no layout, so a test of sizes, scrolling or what axe measures belongs in a story or in the E2E suite.
- Vitest transforms the tests with Vite, not with Next's compiler. A module that depends on a Next runtime API, such as `next/navigation`, gets it mocked in the test.
- jsdom and `@testing-library/react` are development dependencies, and jsdom sets the lowest Node version the tests run on.
