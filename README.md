# Teach Me This File

A teacher uploads a file and writes a prompt; an AI then teaches the file's content to a student in a streamed chat, one step at a time, grounded in passages from the file.

Live URL: (coming soon)

## Run locally

```bash
npm install
# optional: put GEMINI_API_KEY=... in a .env file (otherwise paste a key in the app's settings)
npm run dev
```

## Deploy

Import the GitHub repo into Vercel. `vercel.json` builds the React app to `dist/` and runs the Express app as one function under `/api/*`. No environment variable is needed: each user pastes their own key in the app.
