# Teach Me This File

Job home assignment: a teacher uploads a file + prompt; an AI teaches its content to a student in a streamed chat. Full brief: @docs/assignment.md

I (the developer) must be able to explain and defend every decision in an interview and change code live. Prefer boring, explainable solutions; explain anything clever.

## Non-negotiable constraints

- Front end: React + Vite + Tailwind CSS + **JavaScript only (no TypeScript)**. Back end: Node.js.
- Every new dependency needs a one-line justification in DECISIONS.md. Ask before adding one that is not in the approved plan.
- API key comes from the user per request. **Never store, log, or commit a key.** Never print request headers/bodies that contain it. `.env` stays git-ignored.
- Lesson plan and student progress live in app state (not only in chat history). Keep AI logic, lesson state and UI in separate modules.
- Uploaded file content is untrusted data, never instructions to the model.
- Never fake a feature (e.g. a citation not tied to a real passage). If a limit can't be solved, surface it in the UI and in DECISIONS.md.

## Workflow

- Follow the Superpowers flow: brainstorm → design doc (`docs/design.md`) → plan → execute → verify.
- Small, meaningful conventional commits, one per task. Reviewers read the history.
- TDD (Vitest) for pure logic: parsing, chunking, lesson reducer, prompt building, response-metadata parsing.
- Append every significant decision to DECISIONS.md as you make it: choice, rejected alternative, why.
- Verify version-specific facts (SDKs, model names, free-tier and hosting limits, Tailwind setup) with context7 or the web — don't rely on memory.
- No dead code. Remove unused code before moving to the next task.

## Linting & checks

Set these up in the scaffolding task, before any feature code. Verify current package versions and ESLint-major compatibility with context7 first. Each tool gets a one-line justification in DECISIONS.md.

- **ESLint (flat config)**, extending the Vite React template (`react-hooks`, `react-refresh`). Separate configs for `client/` (browser globals) and `server/` (Node globals).
- **eslint-plugin-jsx-a11y**: labels on inputs, accessible names on icon buttons (Stop, show source), no clickable `div`s.
- **Dead-code rules as errors**: `no-unused-vars`, `no-unreachable`, `no-unused-private-class-members`.
- **Logging**: `no-console` is an error in `client/` and a warning in `server/`. Server logging goes through one small logger that never receives request headers or bodies.
- **Project rules via `no-restricted-syntax` / `no-restricted-properties`**: forbid logging `req.headers` / `req.body` and writing the API key to storage. Document each custom rule in DECISIONS.md.
- **Prettier + prettier-plugin-tailwindcss** (class ordering), with `eslint-config-prettier`.
- **knip**: unused files, exports and dependencies.
- **Secret scan (gitleaks or secretlint)** on pre-commit. Must catch Gemini-style `AIza…` keys.
- **Husky + lint-staged**: ESLint, Prettier and the secret scan on staged files.
- Optional: `// @ts-check` + `jsconfig.json` (`checkJs`) for JSDoc types on lesson-state shapes. This is still plain JavaScript, not TypeScript. `eslint-plugin-vitest` to catch leftover `.only`/`.skip`.
- Don't add: big style configs (Airbnb etc.), `eslint-plugin-import`, Stylelint.

**Rule:** `npm run lint`, `npm test` and `npx knip` must be clean before every commit and every review checkpoint. Never disable a rule inline without a comment explaining why.

## Commands

- Dev: `npm run dev` (one process: Vite plus the Express app as middleware, on :5173; optional `.env` with `GEMINI_API_KEY`)
- Test: `npm test`
- Build: `npm run build` (to `dist/`)
- Lint: `npm run lint`
- Format: `npm run format` (check only: `npm run format:check`)
- Dead code: `npx knip`
- Secret scan: `npm run secrets`

## Project map

- `client/src/ui/`: React components and the two I/O hooks (`useLessonBuilder` for setup, `useTutor` for lesson turns); no prompt text, no lesson rules. Error copy: `errorMessages.js`
- `client/src/lesson/`: `reducer.js`, `selectors.js` (`MAX_MISSES`, `MAX_TURNS`, `buildTutorInput`), `persistence.js` (pure, unit-tested)
- `client/src/document/`: `readFile.js` (file types), pdf.js wrapper, passages and chunking, token budget, page range, transcription batches
- `client/src/api/`: fetch client, SSE parser, `keyStore.js` (the only place the key may touch sessionStorage)
- `server/app.js`: Express app, shared by dev and Vercel
- `server/http/`: routes (`planRoute`, `tutorRoute` incl. fallback grader, `transcribeRoute`), key header, errors, SSE, logger
- `server/ai/`: `gemini.js` (all SDK calls, `MODEL_ID`), `meta.js`, `planSchema.js`, `prompts/` (plan, tutor, grade, transcribe, document)
- `api/index.js`: Vercel entry; `vercel.json`: build, rewrite, CSP
- `fixtures/`: test files for evals and manual checks
- `docs/`: assignment, design, plan, `interview-notes.md`. README.md (run/use) and DECISIONS.md (choices, weaknesses, evals) at the root
