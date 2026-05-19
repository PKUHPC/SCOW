export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";

export const AUTH_INTERNAL_URL = process.env.AUTH_INTERNAL_URL || "http://auth:5000";

export const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";

export const BASE_PATH = process.env.NEXT_PUBLIC_RUNTIME_BASE_PATH || "/";
