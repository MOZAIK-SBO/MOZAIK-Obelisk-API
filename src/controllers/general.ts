import { Elysia } from "elysia";

export const generalController = new Elysia();

generalController.get("/health",
    () => { return { timestamp: Date.now(), status: "healthy" } },
    { detail: { tags: ["General"] } }
);
