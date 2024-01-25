import { Elysia, t } from "elysia";

export const obeliskController = new Elysia({ prefix: "/obelisk" });

obeliskController.post("/ingest/:id",
    ({ params: { id } }) => ingestData(id),
    {
        params: t.Object({
            id: t.Numeric()
        }),
        detail: { tags: ["Obelisk"] }
    }
);



function ingestData(id: number) {
    return `ingestData: ${id}`;
}
