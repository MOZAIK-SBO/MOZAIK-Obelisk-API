import { Elysia } from "elysia";

export const generalController = new Elysia();

// TODO
generalController.get("/status",
    () => getStatus(),
    { detail: { tags: ["General"] } }
);


function getStatus() {
    return "Ok";
}
