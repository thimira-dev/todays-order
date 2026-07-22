import PocketBase from 'pocketbase'

// Local dev defaults to 127.0.0.1:8090; production reads VITE_POCKETBASE_URL
// (set in Vercel project env vars / .env)
const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL ?? 'http://127.0.0.1:8090')

// Prevents React StrictMode double-renders from cancelling duplicate requests
pb.autoCancellation(false)

export default pb
