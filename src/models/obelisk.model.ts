import { Elysia, t } from "elysia";

const IngestBatch =
    t.Array(t.Object({
        timestamp: t.MaybeEmpty(t.Numeric()),
        metric: t.String(),
        value: t.Any(),
        source: t.MaybeEmpty(t.String()),
        tags: t.MaybeEmpty(t.Array(t.String())),
        location: t.MaybeEmpty(t.Object({ lat: t.Numeric(), lng: t.Numeric() })),
        elevation: t.MaybeEmpty(t.Numeric())
    }));



export const obeliskModel = new Elysia({ name: "obeliskModel" })
    .model({
        IngestBatch: IngestBatch
    });
