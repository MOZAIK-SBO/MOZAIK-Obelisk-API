import { Elysia, t } from "elysia";
import { obeliskModel } from "../models/obelisk.model";

export const obeliskController = new Elysia({ prefix: "/obelisk" })
    .use(obeliskModel);

// TODO: something with key management?
obeliskController.post("/ingest/:datasetId",
    ({ params: { datasetId }, query, body }) => {
        // TODO
        return { datasetId, query, body };
    },
    {
        params: t.Object({
            datasetId: t.String()
        }),
        query: t.Object({
            timestampPrecision: t.Optional(t.String({ pattern: "milliseconds|microseconds|seconds" })),
            mode: t.Optional(t.String({ pattern: "default|stream_only|store_only" })),
        }),
        body: "IngestBatch",
        detail: { tags: ["Obelisk"] }
    }
);

