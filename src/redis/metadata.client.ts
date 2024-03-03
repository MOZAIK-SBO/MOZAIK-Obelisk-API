import { createClient } from "redis";

export const metadata_client = await createClient({ url: process.env.METADATA_URL })
    .on("error", err => console.error("Redis: Metadata client error", err))
    .connect();
