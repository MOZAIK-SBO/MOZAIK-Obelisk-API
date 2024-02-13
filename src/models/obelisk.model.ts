import { Elysia, t } from "elysia";

const IngestBatch =
    t.Array(t.Object({
        timestamp: t.Optional(t.Numeric()),
        metric: t.String(),
        value: t.Any(),
        source: t.Optional(t.String()),
        tags: t.Optional(t.Array(t.String())),
        location: t.Optional(t.Object({ lat: t.Numeric(), lng: t.Numeric() })),
        elevation: t.Optional(t.Numeric())
    }));



export const obeliskModel = new Elysia({ name: "obeliskModel" })
    .model({
        IngestBatch: IngestBatch
    });
