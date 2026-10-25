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

### D3. One AI provider: Google Gemini, model `gemini-3.5-flash-lite`

- **Chose:** Gemini only. Every call to the SDK lives in one server file, and the model ID is one constant. The model is `gemini-3.5-flash-lite`, chosen after a smoke test on 2026-10-25 with a free-tier key: `gemini-3.8-flash` gave no response within 60 s twice, `gemini-3.6-flash` took about 22 s to the first token, `gemini-3.5-flash-lite` took 0.7–2.5 s; JSON schema output and abort were verified on it.
- **Rejected:** a thin adapter for Gemini + Groq; OpenRouter. `gemini-3.8-flash` and `gemini-3.6-flash`, for latency (a chat that waits 20 s or more per turn does not feel like a lesson).
- **Why:** Gemini has a free tier and reads PDFs and images natively (useful for scanned pages, formulas and tables), with a 1M-token context. Groq's free tier has no confirmed PDF/image input, so behaviour would differ by provider and double the testing. OpenRouter's free models allow 50 requests per day without paid credits and can disappear without notice. Checked on 2026-10-25 on Google's models and pricing pages.
- **Trade-off:** a smaller model may teach less well; the test scenarios check it. Switching back is one constant.

### D4. File types: PDF, images (JPG/PNG/WebP), TXT/Markdown

- **Chose:** these three families. DOCX and anything else get a clear "export as PDF" message.
- **Rejected:** DOCX through the `mammoth` library.
- **Why:** PDF and phone photos cover most school material. DOCX would add a dependency and loses equations and images. TXT/MD costs nothing and is useful for our own tests.

### D5. Reading files: hybrid (text layer in the browser, AI transcription for scans)

- **Chose:** pdf.js in the browser extracts each page's text layer. Pages with no text (scans) and uploaded images are shrunk to JPEG and sent to Gemini once to transcribe (math as LaTeX, tables as Markdown), at most 20 pages.
- **Rejected:** (a) sending the whole PDF to Gemini to transcribe every page; (b) OCR in the browser with tesseract.js.
- **Why:** text-layer extraction is instant, free and word-for-word, so most citations are the real text. (a) is slow (every page becomes output tokens; a 50-page file takes minutes and hits the 300 s function limit), long files get cut at 65K output tokens, and every citation would be a model transcription. (b) downloads several MB of language data and is weak on Hebrew, Arabic and math. Transcribed passages are labelled "AI transcription" in the UI so the source is honest.
- **Transcription details:** `POST /api/transcribe` takes 1–8 page JPEGs (`{ page, imageBase64 }`) and answers `{ pages: [{ page, readable, markdown }] }` through a JSON schema. The prompt asks for a verbatim transcription in the original language and reading order, formulas as LaTeX between single dollar signs, tables as Markdown tables, blanks as `____`, and treats text in the image as data, never instructions. The server keeps only the requested page numbers, treats a page the model left out or answered with blank text as unreadable, and cuts a page's Markdown at 20,000 characters (no real page is that long). The client renders only the scanned pages in the chosen range, sends them in batches of at most 8 pages and 3 MB of JSON (`base64.length + 64` per page, `client/src/document/batches.js`), one batch at a time, and keeps each page's transcription across Retry so a page is sent once. Transcribed passages keep their Markdown blocks (paragraphs, tables), not single lines.
- **Honest gaps:** a page Gemini cannot read is skipped as `unreadable` ("Gemini found no legible text" in "What's included"), never guessed. On `RATE_LIMITED` the builder waits once on its own (at most 60 s, with a countdown and Cancel) and retries the same batch; if that fails too, the teacher gets Retry or "Continue without pages N–M", and those pages are recorded as `not-transcribed`. Other errors stop the build with the usual copy.
- **Page images:** the JPEG of each transcribed page stays in memory (an object URL held by `App`, never in the persisted lesson), so the source panel can show the original page next to its transcription; after a reload it says "Page image not available after reload". The URLs are freed when the lesson ends or a new one replaces it.
- **Prompt iterations (gemini-3.5-flash-lite, `fixtures/worksheet.jpg`):** with `$$…$$` for display formulas the model twice closed `$$v = \frac{d}{t}$|`, which broke rendering; single dollar signs fixed it. It wrote a fill-in blank as `\textunderscore` (which JSON turns into a tab), so the prompt now asks for `____`.
- **Verified (2026-10-25, pdfjs-dist 6.4.299, Hebrew PDF printed from Chrome):** pdf.js returns Hebrew in logical order, letters and words not reversed ("מחזור המים הוא התהליך שבו המים נעים…" matches the source). Arabic and PDFs from other producers are not tested.

### D6. Hosting: one Vercel project (static SPA + Express as one function)

- **Chose:** Vercel Hobby. The built React app is served as static files and the Express app runs as one function on the same origin (no CORS). Locally the same Express app runs inside the Vite dev server (D14).
- **Rejected:** Render free (one Node service); a split setup (static host + API host).
- **Why:** Render's free service sleeps after 15 minutes idle and takes up to a minute to wake, which is exactly when a reviewer opens the link. Vercel does not sleep. Its limits (4.5 MB per request, 300 s per call including streaming) fit this design: each tutor turn is a short request, and only text and single page images are uploaded. A split setup adds CORS and two deployments for no benefit.
- **Wiring:** `api/index.js` default-exports the Express app; `vercel.json` rewrites `/api/*` to it.

### D7. Architecture: the browser owns the lesson, the server is stateless

- **Chose:** the browser reads the file and keeps the passages, plan, progress and messages (a reducer). The server has three working endpoints (`/api/transcribe`, `/api/plan`, `/api/tutor`) plus `/api/config`, which only says whether a host key is set, and remembers nothing between requests. Each request carries what that call needs (for a tutor turn: brief, current step, its passages, recent messages).
- **Rejected:** a server that parses the upload and stores the lesson in a database.
- **Why:** Vercel functions share no memory between requests, so server-side lessons need a database, and uploading whole files hits the 4.5 MB limit. A stateless server also makes "we never store your key or your files" easy to keep. Cost: each tutor request resends a few KB of passages. If sharing were needed later, the lesson state is already a plain object that could be saved behind an ID without changing the reducer, prompts or UI.

### D8. Lesson signals: a hidden JSON block after the tutor's message

- **Chose:** the tutor streams its message, then writes `<<<META>>>` and a small JSON object (`understanding`, `passageIds`). A tested parser on the server hides the marker from the stream and sends the parsed result as a final event.
- **Rejected:** (a) a second, non-streamed "grading" call per turn with guaranteed JSON; (b) Gemini function calling during the stream.
- **Why:** one call per turn is faster and uses half the free-tier quota of (a). The parser is a small pure function that is easy to test and explain. (b) depends on provider-specific streaming behaviour and is harder to test. If the block is missing or broken (or the user pressed Stop), the turn simply does not count: no progress and no citation, never a guess. (a) is the upgrade path if evals show the block is unreliable.

### D9. The model judges understanding, the app decides what happens

- **Chose:** each tutor turn reports `understanding: yes | partial | no | none`. The reducer applies fixed rules: yes → next step (the tutor only confirms; the app's next turn introduces the step); partial/no → count a miss. The second attempt is flagged `lastAttempt` in the request, so if it is still wrong the tutor explains the answer with a worked example in that same reply, and the reducer marks the step explained and moves on. After 4 student messages on a step without a judged answer, an explain turn does the same.
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

### D16. Lesson plan: one JSON call, validated by the server, retried once

- **Chose:** `/api/plan` asks Gemini for JSON that matches a schema, then the server checks it (3–8 steps, every step cites at least one passage id that was sent, required text present and at most 500 characters, a BCP-47 language tag). A plan that fails is asked for once more, then the teacher sees "Couldn't build a lesson from this file. Try again." The server assigns step ids `s1…sN` and defaults the duration to 15 minutes. The model can answer `ok: false` with a reason when the file has nothing to teach.
- **Rejected:** trusting the schema alone; repairing a bad plan (dropping unknown ids or extra steps).
- **Why:** the schema shapes the output but does not guarantee ids exist or limits hold, and the tutor endpoint rejects plan text over 500 characters and more than 8 steps. Repairing silently could leave a step with no real source passage, which would make citations fake. One retry keeps the cost and the wait bounded.
- **Prompt:** the rules and the teacher prompt (in a `<teacher_instructions>` fence) are in the system instruction; the document goes in the user turn inside `<document>` as data. The prompt states the step count (one step per 2.5 minutes, 3–8), one idea per step, and a check question answerable from the step's passages. The step count is given as a formula with examples (15 minutes → 6 steps) rather than a number, because the duration is extracted from the teacher prompt in the same call. Real runs led to three changes: a title names exactly one concept and a check question is a single question with one question mark (worded without English-only tests such as "if the title needs _and_", which fail in French); step 1 introduces the document's central idea; the last step connects the ideas when the document shows how they fit together.

### D17. Setup flow: a three-stop route, optional prompt, errors where they happen

- **Chose:** the setup screen is the same "route" as the lesson (D13): three stops (file, how to teach it, build) with one amber "you are here" marker on the first stop that is not done. The teacher prompt is optional: with no prompt the plan uses the document's language and default pacing. Errors appear under the stop that caused them, with the one button that fixes them (copy lives in `client/src/ui/errorMessages.js`). Key errors open the settings dialog with the reason. Build lesson is disabled until there is a file, a usable page range and a key; the reason is shown next to it.
- **Rejected:** a multi-screen wizard; a modal error dialog; making the prompt required.
- **Why:** one screen is faster on a phone and the route teaches the visual language before the lesson starts. An empty prompt still yields a sensible lesson, so blocking on it would only add friction.
- **Details:** pdf.js (~430 kB) is loaded with a dynamic `import()` only when a PDF is picked, so the first screen stays small. An empty text file is reported as `NO_CONTENT` as soon as it is read, not after pressing Build. The file is read in the browser with a page-by-page progress line and Cancel (an `AbortController` stops reading and the plan request). PDF pages are rendered for transcription so their long side is exactly 1,600 px (vector pages can be scaled up for sharper text); photos are only scaled down.
- **Scanned pages:** the setup screen says how many pages Gemini will transcribe before planning (D5).

### D18. Lesson screen: the app runs the turns, the chat only shows them

- **Chose:** one hook (`client/src/ui/useTutor.js`) turns the stream into reducer actions; it owns the only `AbortController`, so at most one turn is in flight, Stop aborts it and leaving the lesson aborts it. Automatic turns (introduce a step, wrap up) start when the reducer sets `pendingAuto`, from a zero-delay timer that the effect cleanup cancels, so React StrictMode's double mount starts them once. A student turn is built from the state _after_ `studentSent` (the reducer is called directly on the current state), so the request always ends with the new message. Header: title, the route (one stop per step, amber "you are here", mirrored in Hebrew/Arabic lessons), "Step 2 of 5", "~4 / 15 min", and a menu with "What's included" and New lesson (with confirmation). The source panel is a bottom sheet on phones (native `<dialog>`: focus trap, Escape) and a side panel from `md` up, so the student can keep answering while reading the source.
- **Rejected:** keeping turn logic in the components; a "Next step" button instead of automatic introductions; a modal source panel on desktop.
- **Why:** the reducer decides, the hook does I/O, the components render: each part can be explained and changed alone.
- **Details:** the lesson is saved when a turn starts (the student message plus an empty tutor stub) and when it ends, but not while tutor text streams in (that would rewrite the whole lesson on every chunk). A reload mid-answer therefore keeps the student's message and restores the stub as stopped. "Continue the lesson" re-runs a stopped turn that is the latest message and is either automatic (introduce / wrap-up: otherwise the student has no question, and a stopped wrap-up could never end the lesson) or empty (stopped before its first word, e.g. by that reload); the re-run leaves the stopped message out of the history. Only the latest failed turn offers its fix (Retry, or Open settings); the alert text is fixed and the rate-limit countdown is only on the button, so screen readers do not hear it every second. While the tutor answers, the composer is read-only, not disabled, so it keeps focus and a phone keeps its keyboard open. The composer blocks a message with a line starting with `[app]` and says why, because the server rejects it (D15). A tutor message whose turn sent no valid citation says "No source for this message" instead of showing a chip. A finished tutor message is announced once to screen readers as plain text. Lesson text sets its own direction (`dir="auto"`), formulas are always left to right. The app bar sits on top of the chat column, so the desktop source panel runs the full height beside it.
- **Loading:** the lesson screen (with react-markdown and KaTeX) is a lazy chunk, so the setup screen loads only what it needs; if the chunk cannot be downloaded, the app offers a reload instead of crashing (the lesson is safe in sessionStorage).

### D19. Nothing remote in lesson text, and a Content-Security-Policy

- **Chose:** Markdown from the model or the file never loads anything: an image renders as its alt text only, and a link opens in a new tab (`rel="noopener noreferrer"`) with its site shown after the text, e.g. "the site (example.org)"; non-http links render as plain text. Vercel sends a Content-Security-Policy on every response (`vercel.json`): scripts, connections and workers only from our origin (`blob:` for workers), styles from our origin plus Google Fonts (inline styles allowed for React and KaTeX), fonts from our origin and Google Fonts, images from our origin, `data:` and `blob:`, and no framing.
- **Rejected:** rendering images from model text; relying on react-markdown's URL filter alone.
- **Why:** a remote image or link in a lesson could track a student or send them somewhere unexpected, and the file is untrusted. The CSP is a second line of defence if anything ever slipped through. Checked with the production build: page load, PDF reading (pdf.js worker), the lesson chunk and KaTeX fonts work with the same policy and the console shows no violations.

## What I decided not to do (and why)

- Shareable links / multi-device lessons (D1).
- Teacher editing of the plan (D2).
- DOCX support (D4).
- Multiple AI providers (D3).
- Accounts, lesson history, analytics: not needed to show the teaching loop.

## Known weaknesses

- Free-tier Gemini content may be used by Google to improve its products. Fine for a demo, not for real student data; a paid key or another provider would be needed in production.
- Stop ends our stream and our request to Gemini, but the SDK documents abort as client-side only: Google may still finish (and bill) the generation.
- Transcription quality is the model's: an AI transcription can misread a word or a formula. It is always labelled "AI transcription of page N" and the original page image is shown next to it (until a reload), so the student can check.
- Formulas in PDFs that have a text layer come out as flat text (only scanned pages get LaTeX transcription).
- The tutor's hidden JSON block depends on the model following instructions; when it does not, that turn has no citation and no progress.
- Rate limits of the reviewer's free key can interrupt a lesson (shown clearly, with retry).
- The plan model (`gemini-3.5-flash-lite`) still sometimes puts two concepts in one step, more often in French than in English (for example "L'évaporation et la transpiration"), even after two prompt iterations. Each step still has one check question, and the tutor teaches from that step's passages, so the lesson stays usable.

## With 4 more hours

_To be filled in at the end._

## How I know it works

_Test scenarios with transcripts and pass/fail, filled in during verification._

## Tooling and dependencies

Runtime

- `react`, `react-dom`: the UI library required by the brief.
- `express`: the Node HTTP layer; the same app runs in dev and on Vercel (D6, D14).
- `@google/genai`: Google's official Gemini SDK; streaming, JSON-schema output and abort support without hand-rolled REST.
- `react-markdown`: renders the tutor's Markdown (lists, bold, tables) as React elements without `dangerouslySetInnerHTML`; raw HTML is ignored, so no XSS from model or file text.
- `remark-gfm`: GitHub-flavoured Markdown, needed for tables in school material.
- `remark-math`, `rehype-katex`, `katex`: `$…$` formulas rendered as real math (transcribed scans are LaTeX, and the tutor writes formulas the same way). They load with the lesson screen only (D18).
- `pdfjs-dist`: Mozilla's PDF.js, the standard way to read a PDF's text layer and render pages in the browser; runs its parser in a Web Worker.

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
- One inline disable: `react-hooks/set-state-in-effect` in `App.jsx`, where the result of saving the lesson to sessionStorage is only known after the write, so it is stored in an effect (one extra render per lesson change).
- `no-unused-vars` in `client/` ignores names starting with a capital letter: core ESLint does not count `<Component />` as a use of the import (same setting as the Vite template).
- `no-unused-vars` in `client/` also has `ignoreRestSiblings`: `const { node, ...props } = x` is the plain way to leave a prop out of a spread (used in `Markdown.jsx` so react-markdown's syntax-tree prop never reaches the DOM).
- `no-console` is an error in `client/` and a warning in `server/`; server logging goes through one small logger (added later).
