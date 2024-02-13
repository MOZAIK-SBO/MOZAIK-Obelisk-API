import { Elysia, t } from "elysia";
import { obeliskModel } from "../models/obelisk.model";

export const obeliskController = new Elysia({ prefix: "/obelisk" })
    .use(obeliskModel);

obeliskController.post("/ingest/:datasetId",
    async ({ params: { datasetId }, query: { timestampPrecision, mode }, headers, body }) => {
        return await fetch(
            `${process.env.OBELISK_ENDPOINT}/data/ingest/${datasetId}?timestampPrecision=${timestampPrecision}&mode=${mode}`,
            {
                method: "POST",
                body: JSON.stringify(body),
                headers: { "authorization": headers.authorization }
            }
        );
    },
    {
        params: t.Object({
            datasetId: t.String()
        }),
        query: t.Object({
            timestampPrecision: t.Optional(t.String({ pattern: "^(milliseconds|microseconds|seconds)$", default: "milliseconds" })),
            mode: t.String({ pattern: "^(default|stream_only|store_only)$", default: "default" }),
        }),
        headers: t.Object({
            authorization: t.String()
        }),
        body: "IngestBatch",
        detail: { tags: ["Obelisk"] }
    }
);

