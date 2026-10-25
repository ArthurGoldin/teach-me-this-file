# Decisions

A running log of the choices behind "Teach Me This File": what I chose, what I rejected, and why. Newest entries are added at the end of each section. The full design is in [docs/design.md](docs/design.md).

## Main choices

### D1. The teacher and the student use the same browser

- **Chose:** the teacher sets up the lesson, then the same screen becomes the student's chat. All lesson data stays in that browser tab.
- **Rejected:** a shareable link for students on other devices.
- **Why:** a link means storing files and lessons on a server (database, expiry, privacy of school material). That is about an extra hour and a second hosting service. Same-browser handoff fits the 4-hour budget and lets the server store nothing.

### D2. The teacher cannot edit the lesson plan

- **Chose:** the plan is generated and used as is.
- **Rejected:** a review/edit screen before the lesson starts.
- **Why:** time. It is a real gap (a teacher would want to check the plan), listed under weaknesses.

### D3. One AI provider: Google Gemini, model `gemini-3.8-flash`

- **Chose:** Gemini only. Every call to the SDK lives in one server file, and the model ID is one constant (`gemini-3.5-flash-lite` is the lighter fallback).
- **Rejected:** a thin adapter for Gemini + Groq; OpenRouter.
- **Why:** Gemini has a free tier and reads PDFs and images natively (useful for scanned pages, formulas and tables), with a 1M-token context. Groq's free tier has no confirmed PDF/image input, so behaviour would differ by provider and double the testing. OpenRouter's free models allow 50 requests per day without paid credits and can disappear without notice. Checked on 2026-10-25 on Google's models and pricing pages.

### D4. File types: PDF, images (JPG/PNG/WebP), TXT/Markdown

- **Chose:** these three families. DOCX and anything else get a clear "export as PDF" message.
- **Rejected:** DOCX through the `mammoth` library.
- **Why:** PDF and phone photos cover most school material. DOCX would add a dependency and loses equations and images. TXT/MD costs nothing and is useful for our own tests.

### D5. Reading files: hybrid (text layer in the browser, AI transcription for scans)

- **Chose:** pdf.js in the browser extracts each page's text layer. Pages with no text (scans) and uploaded images are shrunk to JPEG and sent to Gemini once to transcribe (math as LaTeX, tables as Markdown), at most 20 pages.
- **Rejected:** (a) sending the whole PDF to Gemini to transcribe every page; (b) OCR in the browser with tesseract.js.
- **Why:** text-layer extraction is instant, free and word-for-word, so most citations are the real text. (a) is slow (every page becomes output tokens; a 50-page file takes minutes and hits the 300 s function limit), long files get cut at 65K output tokens, and every citation would be a model transcription. (b) downloads several MB of language data and is weak on Hebrew, Arabic and math. Transcribed passages are labelled "AI transcription" in the UI so the source is honest.

### D6. Hosting: one Vercel project (static SPA + Express as one function)

- **Chose:** Vercel Hobby. The built React app is served as static files and the Express app runs as one function on the same origin (no CORS). Locally the same Express app runs inside the Vite dev server (D14).
- **Rejected:** Render free (one Node service); a split setup (static host + API host).
- **Why:** Render's free service sleeps after 15 minutes idle and takes up to a minute to wake, which is exactly when a reviewer opens the link. Vercel does not sleep. Its limits (4.5 MB per request, 300 s per call including streaming) fit this design: each tutor turn is a short request, and only text and single page images are uploaded. A split setup adds CORS and two deployments for no benefit.

### D7. Architecture: the browser owns the lesson, the server is stateless

- **Chose:** the browser reads the file and keeps the passages, plan, progress and messages (a reducer). The server has three working endpoints (`/api/transcribe`, `/api/plan`, `/api/tutor`) plus `/api/config`, which only says whether a host key is set, and remembers nothing between requests. Each request carries what that call needs (for a tutor turn: brief, current step, its passages, recent messages).
- **Rejected:** a server that parses the upload and stores the lesson in a database.
- **Why:** Vercel functions share no memory between requests, so server-side lessons need a database, and uploading whole files hits the 4.5 MB limit. A stateless server also makes "we never store your key or your files" easy to keep. Cost: each tutor request resends a few KB of passages. If sharing were needed later, the lesson state is already a plain object that could be saved behind an ID without changing the reducer, prompts or UI.

### D8. Lesson signals: a hidden JSON block after the tutor's message

- **Chose:** the tutor streams its message, then writes `<<<META>>>` and a small JSON object (`understanding`, `passageIds`). A tested parser on the server hides the marker from the stream and sends the parsed result as a final event.
- **Rejected:** (a) a second, non-streamed "grading" call per turn with guaranteed JSON; (b) Gemini function calling during the stream.
- **Why:** one call per turn is faster and uses half the free-tier quota of (a). The parser is a small pure function that is easy to test and explain. (b) depends on provider-specific streaming behaviour and is harder to test. If the block is missing or broken (or the user pressed Stop), the turn simply does not count: no progress and no citation, never a guess. (a) is the upgrade path if evals show the block is unreliable.

### D9. The model judges understanding, the app decides what happens

- **Chose:** each tutor turn reports `understanding: yes | partial | no | none`. The reducer applies fixed rules: yes → next step; partial/no → count a miss; after 2 misses (or 4 turns on a step) the tutor is told to explain with a worked example and move on.
- **Rejected:** "Got it / Explain again" buttons only; letting the model decide everything.
- **Why:** checking understanding needs the model, but progress must be predictable and testable, and the brief requires progress in app state. The cap stops a student getting stuck forever.

### D10. Long documents: planning budget + page-range picker

- **Chose:** the plan call gets at most ~100K tokens of passages. If a file is bigger, or has more than 20 scanned pages, the setup screen shows a page range ("Pages 1–180 of 412"), pre-filled and editable. What is left out is always shown.
- **Rejected:** silently cutting the file; summarising the whole book first.
- **Why:** a 15-minute lesson cannot cover 400 pages anyway, so the teacher should choose which part. Summarising first needs many calls (rate limits, slow) and produces summaries that are not real sources.

### D11. API key: memory by default, opt-in "remember for this tab"

- **Chose:** the key lives in memory. A checkbox can keep it in sessionStorage (cleared when the tab closes). It is sent in an `X-Gemini-Key` header on every request, never in a URL. The server can also use a `GEMINI_API_KEY` host variable when no key is sent.
- **Rejected:** memory only (a refresh loses the key mid-lesson); sessionStorage always (stores the key without asking).
- **Why:** strict default, convenience only when the user asks for it. Headers, not query strings, because hosting platforms log URLs.

### D12. Lesson survives a refresh (sessionStorage)

- **Chose:** the lesson state is saved to sessionStorage on each change and restored on load. Closing the tab clears it.
- **Rejected:** losing the lesson on refresh; localStorage with "resume later".
- **Why:** an accidental pull-to-refresh on a phone should not end a lesson. localStorage would leave school material on shared computers. Page images of scans are not saved (too large); after a refresh the source panel says so.

### D13. Visual direction: "Lesson route"

- **Chose:** the plan is drawn as a route line with one stop per step and an amber "you are here". One typeface (Lexend), teal and amber on white, familiar chat bubbles, a source chip under tutor messages.
- **Rejected:** "Exercise book" (ruled notebook look) and "Highlighter" (source-first) directions.
- **Why:** progress is a required feature and the route makes it the memorable element. Lexend was designed to make reading easier, which suits students.

### D14. Local dev: Vite mounts the same Express app as middleware

- **Chose:** `npm run dev` starts only Vite; a small Vite plugin mounts `createApp()` from `server/app.js` as middleware. The page and `/api/*` share one process and one port (5173).
- **Rejected:** a separate Node process for the API plus a Vite proxy; running both with the `concurrently` package.
- **Why:** one command, one port, no extra dependency, and the code that runs locally is the same Express app that Vercel runs. Cost: restart the dev server after changing server code. `vite preview` serves only the built files and has no API; use `npm run dev` to try the app.

### D15. Tutor prompt safeguards

- **Whitespace before the marker is held back.** The route sends each delta without its trailing whitespace and puts that whitespace in front of the next delta. Any whitespace left at the end is dropped. The newline the model writes before `<<<META>>>` therefore never reaches the student. Rejected: changing the meta splitter, which would mix two jobs in one tested module.
- **Passage ids are validated** (`/^[\w-]{1,32}$/`) before they go into `<passage id="…">`. They come from the browser, so a crafted id could otherwise break out of the attribute and inject text into the prompt.
- **The `[app]` channel.** Automatic turns (introduce, explain, wrap-up) have no student message, so the app adds a short user note that starts with `[app]` (for example `[app] Begin step 3.`). The rules say these lines come from the app, never from the student. A student message that starts with `[app]` is rejected with 400, so a student cannot forge one. Rejected: escaping the prefix, which is harder to explain and leaves an odd message in history.
- **The lesson outline is sent every turn** (titles and objectives of all steps, current step marked). It is small, it lets the introduce turn link to the previous step, and wrap-up recaps only from the outline and the conversation, so it adds no new facts. Rejected: sending every step's passages for wrap-up, which would cost too many tokens. All plan text (title, step, outline), the teacher prompt and passages are escaped so none of them can close the prompt's `<document>`, `<passage>` or `<teacher_instructions>` tags.
- **`MODEL_ID` stays private to `gemini.js`.** No other module needs it yet, and knip flags unused exports (no dead code).

## What I decided not to do (and why)

- Shareable links / multi-device lessons (D1).
- Teacher editing of the plan (D2).
- DOCX support (D4).
- Multiple AI providers (D3).
- Accounts, lesson history, analytics: not needed to show the teaching loop.

## Known weaknesses

- Free-tier Gemini content may be used by Google to improve its products. Fine for a demo, not for real student data; a paid key or another provider would be needed in production.
- Stop ends our stream and our request to Gemini, but the SDK documents abort as client-side only: Google may still finish (and bill) the generation.
- Formulas in PDFs that have a text layer come out as flat text (only scanned pages get LaTeX transcription).
- Hebrew/Arabic text order from pdf.js still to be verified (spike planned).
- The tutor's hidden JSON block depends on the model following instructions; when it does not, that turn has no citation and no progress.
- Rate limits of the reviewer's free key can interrupt a lesson (shown clearly, with retry).

## With 4 more hours

_To be filled in at the end._

## How I know it works

_Test scenarios with transcripts and pass/fail, filled in during verification._

## Tooling and dependencies

Runtime

- `react`, `react-dom`: the UI library required by the brief.
- `express`: the Node HTTP layer; the same app runs in dev and on Vercel (D6, D14).
- `@google/genai`: Google's official Gemini SDK; streaming, JSON-schema output and abort support without hand-rolled REST.

Build and test

- `vite`, `@vitejs/plugin-react`: required dev server and bundler for React.
- `tailwindcss`, `@tailwindcss/vite`: required styling; the Vite plugin is the Tailwind 4 setup, with no PostCSS config.
- `vitest`: unit tests for the pure logic; shares Vite's config style.

Lint, format and checks

- `eslint`, `@eslint/js`: linting. Pinned to 9.x because `eslint-plugin-jsx-a11y` 6.10 does not support ESLint 10 yet (checked 2026-10-25).
- `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`: the rules of the Vite React template (hook mistakes, hot-reload-safe exports).
- `eslint-plugin-jsx-a11y`: labels on inputs, names on icon buttons, no clickable `div`s.
- `globals`: browser and Node global names for the separate client and server configs.
- `prettier`, `prettier-plugin-tailwindcss`: one formatting style and Tailwind class order, so diffs stay small.
- `eslint-config-prettier`: turns off ESLint rules that fight Prettier.
- `knip`: finds unused files, exports and dependencies (the "no dead code" rule). Its `ignoreDependencies` lists `tailwindcss` and the two secretlint rule packages: they are used only through a CSS `@import` and a JSON config, which knip cannot see.
- `secretlint`, `@secretlint/secretlint-rule-preset-recommend`: blocks committed secrets.
- `@secretlint/secretlint-rule-pattern`: the recommended preset does not detect Gemini `AIza...` keys, so one custom pattern covers them.
- `husky`, `lint-staged`: run ESLint, Prettier and the secret scan on staged files before each commit.

Custom lint rules

- `no-restricted-syntax` on `console.*(req.headers|req.body)`: the API key travels in headers and bodies, so they must never be logged.
- `no-restricted-properties` on `localStorage`: the app never uses it (D11, D12).
- `no-restricted-properties` on `sessionStorage`: only `keyStore.js` and `persistence.js` may use it, so the key cannot be stored by accident.
- `no-restricted-properties` on `describe|it|test` `.only|.skip` in tests: a focused or skipped test must not be committed (done with core ESLint instead of `eslint-plugin-vitest`, to avoid a dependency).
- `no-unused-vars` in `client/` ignores names starting with a capital letter: core ESLint does not count `<Component />` as a use of the import (same setting as the Vite template).
- `no-console` is an error in `client/` and a warning in `server/`; server logging goes through one small logger (added later).
