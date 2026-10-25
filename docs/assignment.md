# Home Assignment · AI Engineer — "Teach Me This File"

> Build an AI that turns a file and a prompt into a chat that actually teaches.

| Time          | Stack                             | Deliver                |
| ------------- | --------------------------------- | ---------------------- |
| About 4 hours | React, Vite, Tailwind, JavaScript | GitHub repo + live URL |

---

## 1. Why this assignment

We build tools that help teachers and students learn. We are a small team of highly capable developers, and we want to work with people who are eager to learn and ready to work hard. This assignment is a small version of a real problem we work on. We hope you enjoy it.

You may use AI coding assistants, as we do. But you will have to understand and explain every choice you made. We care about how you think, not only about what you ship.

## 2. The challenge

Build a web app where a teacher uploads a file and writes a prompt. The app then opens a chat in which an AI teaches the content of the file to a student, following the teacher's prompt.

Example prompt: _"Teach this to 7th graders, in French. Be Socratic. Keep it under 15 minutes."_

The chat must teach. It must not just summarize the file or paste its content. Think about how a good teacher behaves.

## 3. What the app must have

- A screen to upload a file and write the teacher prompt.
- A chat screen where the lesson happens, with streaming answers and a way to stop a response.
- A visible progress of the lesson (for example "step 3 of 7").
- A way to see the source passage behind a message.
- Loading, error and empty states. It must be usable on a phone.
- A clear separation between the AI logic, the lesson state and the UI. The lesson plan and the student progress must be stored in your app state, not only inside the chat history.

Everything else is your choice: which file types you support, which AI provider and model, how you read the file, how you design the lesson, how you make it feel good to use.

We will test your app with files you have not seen. Think of real school material: other languages (including right-to-left), scanned pages, formulas, tables, very long documents, or files with unexpected content. Build for the unexpected.

## 4. Technical rules

- **Stack:** React with Vite, Tailwind CSS and JavaScript on the front end, and Node.js on the back end. This is the same stack we use at work. You can add libraries, but be ready to justify them.
- **AI provider:** your choice. We do not provide an API key. Free options exist, for example Google AI Studio (Gemini), Groq, or OpenRouter free models.
- **Hosting:** your app must be online, with the front end and the back end working together. There are many free solutions to host it, so pick one. Be aware of the limits of free hosting (for example the size of a request, the duration of a request, or a server that goes to sleep). Designing around them is part of the work.
- **API key:** reviewers will use their own key. Add a small settings field where the user pastes a key. Send it to your server with each request and **never store or log it**. **Never commit a key to GitHub.** You may also support a key set in the environment variables of your host, as an extra.
- Make small, meaningful commits as you work. We read the history.

## 5. What you send us

1. GitHub repository link (public).
2. Live URL where we can use the app. Check that it works in a private browser window before you send it.
3. `README.md` with how to run the project and how to use the app.
4. `DECISIONS.md` with:
   - The main choices you made and why.
   - What you decided not to do, and why.
   - The weaknesses you know about.
   - What you would do with 4 more hours.
   - How you know it works: about 5 test scenarios you used to check the AI's behavior (for example: "the student answers wrong and the tutor does not just give the answer"). "It looked fine to me" is not enough.

Reply to the email you received this assignment with both links, before the deadline given in that email.

## 6. How we will judge your work

| Criteria              | What we look at                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisions             | Are your choices clear, justified and honest? Do you know your weak points?                                                                        |
| Code quality          | Readable, simple, consistent, easy to change. No dead code.                                                                                        |
| Architecture          | Clear separation of parts, sensible state, good handling of errors, large files and cost.                                                          |
| UX                    | Is the flow clear? Does the app feel good while waiting, failing or recovering?                                                                    |
| UI                    | Clean, consistent, polished design, also on mobile.                                                                                                |
| Approach to education | Does the AI teach like a good teacher: one step at a time, checks understanding, adapts, stays grounded in the file, follows the teacher's prompt? |

A smaller, polished result is better than a bigger, broken one.

## 7. What happens next

1. Online interview. You present your project and explain how and why you built it. We may ask you to change something live.
2. Onsite interview in our office. You work with us, in real conditions.
3. Meet the founders.
4. Decision.

Questions about the assignment? Just ask, we are happy to clarify. Good luck, and have fun!
