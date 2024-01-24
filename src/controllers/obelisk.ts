import { Elysia } from "elysia";


export const obeliskController = new Elysia({ prefix: "/obelisk" });


obeliskController.get("/test", () => "test", { detail: { tags: ["Obelisk"] } });

