import { Elysia, t } from "elysia";


const SubmitBatch = t.Object({
    batch_size: t.Numeric({
        description: "The size of the batch. This is the amount of total data points in the batch. Example: a batch size of 64 data points, with 2 unique users, means 2 queued analyses of 32 data points each in this batch."
    }),
    analysis_data_point_count: t.Numeric({ description: "Amount of data points per analysis. This depends on the batch size and the amount of analyses in the batch." }),
    analysis_ids: t.Array(t.String(), { description: "List of analysis ids in this batch." }),
    analysis_type: t.String({
        description: "The model that should be used for this batched MPC computation."
    }),
    online_only: t.Optional(
        t.Boolean({
            default: false,
            description: "If this batched computation should only run the online phase. This means that the offline pre-processing phase has already been done (by calling GET /offline on the involved MPC parties). If this flag is set to true, but pre-processing was not performed, the batched computation will fail. Defaults to `false`."
        })
    ),
    streaming: t.Optional(
        t.Array(
            t.Array(t.Numeric()),
            {
                description: "Optional parameter to indicate this batch was generated in a streaming scenario. This parameter contains a list of lists in the following format: `[[start_time, end_time], ...]`, where each `start_time` is the start time a certain user enabled streaming, `end_time` when the streaming expires."
            }
        ),
    )
});

const BatchInfoEntity = t.Object({
    batch_id: t.String(),
    batch_size: t.Number(),
    analysis_data_point_count: t.Number(),
    analysis_ids: t.Array(t.String()),
    user_ids: t.Array(t.String()),
    analysis_type: t.String(),
    online_only: t.Boolean(),
    parties: t.Array(t.String()),
    created_at: t.Number(),
    first_keys_exp_at: t.Number(),
    latest_status: t.String(),
    invoker: t.String()
});

export const BatchInfoEntities = t.Array(BatchInfoEntity);


export const batchesModel = new Elysia({ name: "batchesModel" }).model({
    SubmitBatch
});
