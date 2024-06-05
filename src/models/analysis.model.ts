import { Elysia, t } from "elysia";

const PrepareMpcAnalysis = t.Object({
  parties: t.Array(
    t.Object({
      mpc_id: t.String(),
      key_share: t.String(),
    }),
    {
      description:
        "Array of MPC parties with their respective key share that need to perform the computation.",
    },
  ),
  exp_hours: t.Numeric({
    description: "Amount of hours until the analysis (and key shares) expires.",
  }),
  user_key: t.String({ description: "The user's public key." }),
  data: t.Object({
    source: t.String({
      description: "The source dataset with encrypted IoT data.",
    }),
    result: t.String({
      description: "The result dataset where the result needs to be stored.",
    }),
    metric: t.String({
      description:
        "The name and type of the metric. E.g., this can be 'ecg::json' for ECG data.",
    }),
    index: t.Array(t.Numeric(), {
      description: "Array of timestamps of the encrypted data points.",
    }),
  }),
  analysis_type: t.String({
    description: "The model that needs to be used in MPC.",
  }),
});

const PrepareFheAnalysis = t.Object({
  user_key: t.String({ description: "The user's public key." }),
  data: t.Object({
    source: t.String({
      description: "The source dataset with encrypted IoT data.",
    }),
    result: t.String({
      description: "The result dataset where the result needs to be stored.",
    }),
    metric: t.String({
      description:
        "The name and type of the metric. E.g., this can be 'ecg::json' for ECG data.",
    }),
    index: t.Array(t.Numeric(), {
      description: "Array of timestamps of the encrypted data points.",
    }),
  }),
  analysis_type: t.String({
    description: "The model that needs to be used in MPC.",
  }),
});

const FetchAnalysisData = t.Object({
  user_id: t.String({ description: "User id associated with the analysis." }),
  data_index: t.Array(t.Numeric(), {
    description: "Array of timestamps of the encrypted data points.",
  }),
});

const StoreAnalysisResult = t.Object({
  user_id: t.String({ description: "User id associated with the analysis." }),
  is_combined: t.Optional(
    t.Boolean({
      default: false,
      description:
        "For MPC: Whether the result is the combined ciphertext result generated running DistEnc (`true`), or if it is a ciphertext result share (`false`). For FHE: always `true`.",
    }),
  ),
  result: t.String({ description: "Ciphertext of the result (share)." }),
});

export const MpcQueryDataResult = t.Object({
  user_data: t.Array(t.String()),
});

const AnalysisEntity = t.Object({
  analysis_id: t.String(),
  user_id: t.String(),
  user_key: t.String(),
  source_dataset: t.String(),
  result_dataset: t.String(),
  metric: t.String(),
  data_index: t.Array(t.Number()),
  result_timestamps: t.Array(t.Number()),
  parties: t.Array(t.String()),
  analysis_type: t.String(),
  created_at: t.Number(),
  keys_exp_at: t.Number(),
  latest_status: t.String(),
});

export const AnalysisEntities = t.Array(AnalysisEntity);

export const analysisModel = new Elysia({ name: "analysisModel" }).model({
  PrepareMpcAnalysis,
  PrepareFheAnalysis,
  FetchAnalysisData,
  StoreAnalysisResult,
  MpcQueryDataResult,
});
