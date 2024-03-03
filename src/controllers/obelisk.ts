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
                headers: {
                    "authorization": headers.authorization,
                    "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(5000)
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
        authorization: t.String({ description: "JWT Bearer token." })
    }),
    body: "IngestBatch",
    response: {
        204: t.Undefined(),
        500: t.Any()
    },
    detail: {
        tags: ["Obelisk"],
        description: "Directly ingest into Obelisk. This only exists for development purposes in the PoC. Should not be exposed on the production version of MOZAIK."
    }
});

obeliskController.post("/query",
    async ({ headers, body }) => {
        return await fetch(
            `${process.env.OBELISK_ENDPOINT}/data/query/events`,
            {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    "authorization": headers.authorization,
                    "Content-Type": "application/json",
                },
                signal: AbortSignal.timeout(10000)
            }
        );
    }, {
    headers: t.Object({
        authorization: t.String({ description: "JWT Bearer token." })
    }),
    body: "EventsQuery",
    response: {
        200: EventsQueryResult,
        500: t.Any()
    },
    detail: {
        tags: ["Obelisk"],
        description: "Directly query Obelisk. This only exists for development purposes in the PoC. Should not be exposed on the production version of MOZAIK."
    }
});
