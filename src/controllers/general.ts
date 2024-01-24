import { Elysia } from "elysia";

export const generalController = new Elysia({});

// TODO
generalController.get("/status", () => "OK", { detail: { tags: ["General"] } });


