// Blocks that exist in code but stay hidden until NR Enterprise confirms the content.
export const SHOW_CAPACITY = false;
export const SHOW_STATS = false;

export const USE_MOCK = import.meta.env["VITE_USE_MOCK"] !== "false";
export const API_BASE = (import.meta.env["VITE_API_BASE"] as string | undefined) ?? "/api/v1";
