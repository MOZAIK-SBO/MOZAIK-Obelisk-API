import { createClient } from "redis";

export const keys_client = await createClient({ url: process.env.KEY_STORE_URL })
    .on("error", err => console.error("Redis: Key store client error", err))
    .connect();

