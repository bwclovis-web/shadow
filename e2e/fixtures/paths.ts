import path from "node:path"

export const AUTH_DIR = path.join(__dirname, "..", ".auth")
export const FREE_AUTH_FILE = path.join(AUTH_DIR, "free.json")
export const PREMIUM_AUTH_FILE = path.join(AUTH_DIR, "premium.json")
