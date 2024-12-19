import { Repository, Schema } from "redis-om";
import { metadata_client } from "./metadata.client";

const mpcPartySchema = new Schema("mpc-parties", {
  mpc_id: { type: "string" },
  mpc_key: { type: "string" },
  host: { type: "string" },
  region: { type: "string" },
});

export const mpcPartyRepository = new Repository(
  mpcPartySchema,
  metadata_client,
);

const analysisSchema = new Schema("analyses", {
  user_id: { type: "string" },
  user_key: { type: "string" },
  source_dataset: { type: "string" },
  result_dataset: { type: "string" },
  metric: { type: "string" },
  data_index: { type: "number[]" },
  result_timestamps: { type: "number[]" },
  parties: { type: "string[]" },
  analysis_type: { type: "string" },
  created_at: { type: "number" },
  keys_exp_at: { type: "number" },
  latest_status: { type: "string" },
});

export const analysisSchemaRepository = new Repository(
  analysisSchema,
  metadata_client,
);

const batchInfoSchema = new Schema("batch-info", {
  // Assume batch size of 64. This means batch size of 64 data points. Thus 64/analysis_data_point_count = |user_ids| = |analysis_ids|. This implies that 64 = |user_ids| * analysis_data_point_count
  batch_size: { type: "number" },
  analysis_data_point_count: { type: "number" },

  analysis_ids: { type: "string[]" },
  user_ids: { type: "string[]" },

  analysis_type: { type: "string" },
  online_only: { type: "boolean" },

  // All the analyses in this batch selected the same parties
  parties: { type: "string[]" },

  created_at: { type: "number" },
  // The analysis in this batch where the keys expires the quickest will determine first_keys_exp_at
  first_keys_exp_at: { type: "number" },
  // The least advanced status of all the analyses in the batch will be stored in latest_status
  latest_status: { type: "string" },
});

export const batchInfoSchemaRepository = new Repository(
  batchInfoSchema,
  metadata_client,
);

const streamingInfoSchema = new Schema('streaming-info', {
  analysis_type: { type: "string" },
  batch_size: { type: "number" },
  key_shares: { type: "string[]" },
  keys_exp_at: { type: "number" },
  source: { type: "string" },
  result: { type: "string" },

  // History of all the batches that have been submitted during this streaming session
  submitted_batches: { type: "string[]" },

  // In the streaming scenario, the batch size will be equal to the amount of analyses in the batch (1 data point per analysis)
  current_analysis_ids: { type: "string[]" }
});

export const streamingInfoSchemaRepository = new Repository(
  streamingInfoSchema,
  metadata_client
);

await mpcPartyRepository.createIndex();
await analysisSchemaRepository.createIndex();
await batchInfoSchemaRepository.createIndex();
await streamingInfoSchemaRepository.createIndex();
