import { createApp } from '../server/app.js'

// Vercel runs the default export as the single Node function behind /api/*
// (see the rewrite in vercel.json). Express handles the routing itself.
export default createApp()
