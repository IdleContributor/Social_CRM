import axios from "axios";

// In production, VITE_API_URL is set to the Railway backend (e.g. https://api.simar.dev).
// In local dev, it's empty and Vite proxies /api → localhost:5000.
const BASE = import.meta.env.VITE_API_URL || "";

const api = axios.create({ baseURL: BASE });

export default api;
