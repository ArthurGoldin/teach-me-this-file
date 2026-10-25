# Interview notes

## Architecture in 5 sentences

1. The browser owns everything: it reads the file (pdf.js text layer, images shrunk to JPEG), cuts it into passages with ids, and keeps the plan, progress and messages in one reducer (`client/src/lesson/`), saved to sessionStorage.
2. The server (`server/app.js`, Express, one Vercel function) is stateless: three endpoints (`/api/transcribe`, `/api/plan`, `/api/tutor`) each get everything they need in the request plus the user's key in a header, and remember nothing.
3. Planning is one JSON-schema call that the server validates (3–8 steps, real passage ids, key points, check question) and retries once; tutoring is one streamed call per turn that ends with a hidden `<<<META>>>` JSON block (understanding + cited passage ids).
4. The model judges (`understanding: yes/partial/no/none`), the app decides: the reducer advances, counts misses, flags the last attempt and moves on after two misses, so progress is predictable and unit-tested.
5. The UI only renders: `useLessonBuilder` (setup) and `useTutor` (turns, Stop, one `AbortController`) are the only places that call the AI endpoints, and all Gemini SDK calls are in `server/ai/gemini.js`.

## The 5 hardest decisions and how to defend them

1. **Stateless server, browser-owned state (D7, D1).** Vercel functions share no memory, so server state means a database; whole-file uploads would hit the 4.5 MB request limit. Cost: no share link, and each turn resends a few KB of passages. Upgrade path: the lesson is one plain object; save it behind an ID in a KV store.
2. **Hidden META block + fallback grader (D8).** One call per turn is half the quota of "chat call + grading call". The block went missing in ~6% of turns, so when it is missing (and only then) the server makes one structured grading call. If that fails too, the turn counts nothing: no guessed progress, no fake citation.
3. **Model judges, app decides (D9).** Rules live in `client/src/lesson/reducer.js` and `selectors.js`: `yes` → next step; `partial`/`no` → miss; at `MAX_MISSES - 1` the request has `lastAttempt: true`, so the tutor explains with a worked example in that same reply, and the reducer marks the step explained. `MAX_TURNS` stops a student talking around the question forever. Why: progress must be in app state and testable, not inferred from chat text.
4. **Teach first, with key points (D22).** Found by using the app: with "Be Socratic" the tutor quizzed a student who never saw the file. Wording alone did not fix it, so the plan now carries 2–4 key points per step; the introduce turn teaches all of them, then asks; rule 1 forbids asking about anything not yet taught. Honest limit: on a single-fact step, hints still paraphrase the key point (final re-check: 0 of 5 clean, 1 borderline), though none states the answer as a "because…" sentence and the last attempt explains it.
5. **Hybrid file reading + honest sources (D5).** Text-layer PDFs are read in the browser (instant, free, word-for-word citations); only scans and photos go to Gemini (≤ 20 pages), labelled "AI transcription of page N" with the page image beside it. Rejected: sending the whole PDF to Gemini (slow, every citation becomes a model transcription) and tesseract.js (weak on Hebrew, Arabic, math). Skipped pages are always listed with a reason.

## Likely live-change requests

| Request                       | Where                                                                                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "3 misses instead of 2"       | `MAX_MISSES` in `client/src/lesson/selectors.js` (reducer and `lastAttempt` both read it); update reducer/selectors tests                                                                |
| "More / fewer turns per step" | `MAX_TURNS` in `client/src/lesson/selectors.js`                                                                                                                                          |
| "Change the model"            | `MODEL_ID` in `server/ai/gemini.js`, then re-run the scenarios                                                                                                                           |
| "Longer / shorter steps"      | Step count rule 3 ("one step per 2.5 minutes") in `server/ai/prompts/plan.js`; message length ("60 to 140 words") in `MODE_INSTRUCTIONS.introduce`, `server/ai/prompts/tutor.js`         |
| "Change how hints work"       | Rule 3 and `MODE_INSTRUCTIONS.guide` in `server/ai/prompts/tutor.js`                                                                                                                     |
| "Add DOCX"                    | `kindOf` and a new reader in `client/src/document/readFile.js`; add `.docx` to `ACCEPT` in `client/src/ui/FilePicker.jsx`; remove the `DOCX` message in `client/src/ui/errorMessages.js` |
| "Teacher edits the plan"      | New screen between `useLessonBuilder`'s `build` result (`SetupScreen.jsx` calls `onLessonReady`) and the `lessonCreated` dispatch in `handleLessonReady`, `client/src/ui/App.jsx`        |
| "Shareable link"              | D7 upgrade path: a KV store, a new `server/http/` route to save/load the lesson object, a load path in `App.jsx`                                                                         |
| "Change error copy"           | Client copy: `client/src/ui/errorMessages.js`; server copy and HTTP status per code: `server/http/errors.js`                                                                             |
| "Bigger planning budget"      | `PLAN_TOKEN_BUDGET` in `client/src/document/budget.js` and the server cap `MAX_DOCUMENT_TOKENS` in `server/ai/prompts/plan.js`                                                           |
| "More scanned pages"          | `MAX_SCAN_PAGES` in `client/src/document/budget.js`                                                                                                                                      |
| "Log something new"           | Add the field to `ALLOWED_FIELDS` in `server/http/logger.js` (never headers or bodies)                                                                                                   |

After any change: `npm test && npm run lint && npx knip`.

## 60-second demo script

1. Open the live URL in a private window: the key dialog opens by itself. Paste a key, point out "Remember for this tab" and the privacy note. (10 s)
2. Upload `fixtures/water-cycle-en.pdf`, paste the brief's prompt: "Teach this to 7th graders, in French. Be Socratic. Keep it under 15 minutes." Press Build lesson; show the progress line. (10 s)
3. The route appears: "Step 1 of 6", "~0 / 15 min". The tutor teaches in French, then asks. Press Stop mid-stream on one turn to show it stops cleanly. (10 s)
4. Answer wrong twice: a hint, then the worked explanation, and the route moves on ("explained"). Answer the next one right: it confirms and introduces step 3 by itself. (15 s)
5. Tap the source chip: the exact passage from the PDF. Open ⋯ → "What's included". (10 s)
6. Close with the honest limit: hints sometimes paraphrase the answer on single-fact steps (DECISIONS, Known weaknesses), and what I would do next. (5 s)
