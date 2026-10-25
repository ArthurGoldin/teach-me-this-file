# Teach Me This File

A teacher uploads a file (PDF, photo, text) and writes a short prompt. The app turns the file into a lesson plan, then an AI tutor teaches it to a student in a streamed chat: one step at a time, explaining before asking, checking understanding, and showing the passage of the file behind each message.

**Live:** https://teach-me-this-file-five.vercel.app

Design and reasoning: [DECISIONS.md](DECISIONS.md) (choices, weaknesses, test scenarios) and [docs/design.md](docs/design.md). Screenshots: [docs/screenshots/](docs/screenshots/).

## Get a Gemini key

1. Create a free key in Google AI Studio: https://aistudio.google.com/apikey
2. Open the app. It asks for the key on first load (or use the key button in the top bar).

How the key is handled:

- It is kept in the page's memory and sent to our server in an `X-Gemini-Key` header with each request. The server passes it to Gemini and forgets it: it is never stored, logged or put in a URL.
- Optional **Remember for this tab** keeps it in `sessionStorage`, which the browser clears when the tab closes. Nothing is ever written to `localStorage`.

## How to use

1. **Upload a file**: PDF, image (JPG/PNG/WebP) or text (TXT/MD). Drag it in or pick it.
2. **Write a teacher prompt** (optional), for example:
   _"Teach this to 7th graders, in French. Be Socratic. Keep it under 15 minutes."_
   Without a prompt the lesson uses the file's language and a 15-minute pace.
3. **Build lesson.** The app reads the file in your browser, sends scanned pages to Gemini to transcribe, then asks Gemini for a lesson plan (3–8 steps).
4. **The lesson.**
   - The route at the top shows the steps and where you are ("Step 2 of 6", "~4 / 15 min").
   - The tutor teaches a step, then asks one check question. A right answer moves on; after two wrong answers it explains the answer and moves on.
   - **Stop** ends an answer while it streams. A stopped automatic turn offers "Continue the lesson".
   - **Source** under a tutor message opens the passage it is based on (side panel on desktop, bottom sheet on a phone). Scanned pages show the AI transcription next to the page image.
   - Errors (bad key, rate limit, network) appear next to what failed, with one button that fixes them (Try again, Open settings).
   - The ⋯ menu shows "What's included" (pages used and skipped) and New lesson. A refresh keeps the lesson; closing the tab ends it.

## Supported files and limits

| What               | Limit                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| File types         | PDF, JPG, PNG, WebP, TXT, MD. **DOCX is not supported** (export it as PDF).                      |
| File size          | 50 MB                                                                                            |
| Scanned pages      | Up to 20 per lesson, transcribed by Gemini (formulas as LaTeX, tables as Markdown)               |
| Long documents     | ~100K tokens per plan. Bigger files get a page-range picker, pre-filled; skipped pages are shown |
| Lesson length      | 3–8 steps (one step per ~2.5 minutes asked for)                                                  |
| Right-to-left text | Hebrew and Arabic lessons render right to left; formulas stay left to right                      |

Text-layer PDFs keep formulas as flat text (only scans get LaTeX). See Known weaknesses in [DECISIONS.md](DECISIONS.md).

## Privacy

On the free tier, Google may use what you send to Gemini to improve its products. Do not upload private student data with a free key. The server stores nothing: no files, no lessons, no keys.

## Run locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev          # http://localhost:5173 (Vite and the Express API in one process)
```

Optional: copy `.env.example` to `.env` and set `GEMINI_API_KEY=...`. The local server then uses it when no key is pasted. `.env` is git-ignored.

Checks (run before committing; the pre-commit hook runs ESLint, Prettier and secretlint on staged files):

```bash
npm test             # Vitest unit tests
npm run lint         # ESLint, zero warnings
npx knip             # unused files, exports and dependencies
npm run format:check # Prettier
npm run secrets      # secretlint, including Gemini AIza... keys
npm run build        # production build to dist/
```

A pre-commit hook (Husky + lint-staged) runs ESLint, Prettier and secretlint on staged files.

## Deploy (Vercel)

1. Import the GitHub repository in Vercel. `vercel.json` builds the React app to `dist/`, runs the Express app as one function under `/api/*`, and sets a Content-Security-Policy header.
2. No environment variable is needed: each user pastes their own key.

Optional: set `GEMINI_API_KEY` in Vercel so users can start without a key. **Warning:** anyone with the URL then spends your quota, and there is no rate limiting.

## Project structure

```
client/src/
  ui/         React components and hooks (useLessonBuilder, useTutor); no prompts, no lesson rules
  lesson/     reducer, selectors (MAX_MISSES, request body), sessionStorage persistence
  document/   file reading (pdf.js), passages, token budget, page range, transcription batches
  api/        fetch client, SSE parser, keyStore
server/
  app.js      Express app, shared by local dev and Vercel
  http/       routes (plan, tutor, transcribe), key header, errors, SSE, logger
  ai/         Gemini calls (gemini.js), prompts/, META block parser, plan validation
api/index.js  Vercel entry
fixtures/     test files (Hebrew, Arabic, scanned, 160-page PDF, prompt injection)
docs/         assignment, design, plan, interview notes
```
