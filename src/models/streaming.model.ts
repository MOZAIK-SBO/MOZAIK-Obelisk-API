import { Elysia, t } from "elysia";

const StartStreaming = t.Object({
    analysis_type: t.String({ description: "Model that needs to run." }),
    batch_size: t.Numeric({ description: "Size of the batches that need to be requested during streaming." }),
    key_shares: t.Array(t.String(), { description: "Array of key shares of the involved parties. Ordered `mpc1`, `mpc2`, `mpc3`." }),
    start_time: t.Numeric({ description: "Time when the streaming started." }),
    keys_exp_at: t.Numeric({ description: "Time when the keys expire. Streaming is implicitly stopped when the keys expire." }),
    source: t.String({ description: "The source dataset where streamed data is ingested." }),
    result: t.String({ description: "The result dataset where the results need to be stored." }),
});

export const StreamingInfo = t.Object({
    is_streaming: t.Boolean({ description: "If we are currently streaming. Returns `true` if streaming is enabled, `false` otherwise." }),

    analysis_type: t.Optional(t.String()),
    batch_size: t.Optional(t.Number()),
    keys_exp_at: t.Optional(t.Number()),
    start_time: t.Optional(t.Number()),
    source: t.Optional(t.String()),
    result: t.Optional(t.String()),
    submitted_batches: t.Optional(t.Array(t.String(), { description: "History of all the batches that have been submitted during this streaming session." })),
    current_analysis_ids: t.Optional(t.Array(t.String(), { description: "Current streaming analyses waiting to be batched." })),
});

export const streamingModel = new Elysia({ name: "streamingModel" }).model({
    StartStreaming
});