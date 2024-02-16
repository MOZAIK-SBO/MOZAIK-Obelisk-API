import { Elysia, t } from "elysia";
import { EventsQueryResult, obeliskModel, timestampUnion } from "../models/obelisk.model";

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
    }, {
    params: t.Object({
        datasetId: t.String()
    }),
    query: t.Object({
        timestampPrecision: t.Optional(timestampUnion),
        mode: t.Optional(t.Union([
            t.Literal("default"),
            t.Literal("stream_only"),
            t.Literal("store_only")
        ],
            { default: "default" }
        ))
    }),
    headers: t.Object({
        authorization: t.String()
    }),
    body: "IngestBatch",
    response: {
        204: t.Undefined(),
        500: t.Any()
    },
    detail: { tags: ["Obelisk"] }
});


obeliskController.post("/query/events",
    async ({ headers, body }) => {
        return await fetch(
            `${process.env.OBELISK_ENDPOINT}/data/query/events`,
            {
                method: "POST",
                body: JSON.stringify(body),
                headers: { "authorization": headers.authorization }
            }
        );
    }, {
    headers: t.Object({
        authorization: t.String()
    }),
    body: "EventsQuery",
    response: {
        200: EventsQueryResult,
        500: t.Any()
    },
    detail: { tags: ["Obelisk"] }
});

