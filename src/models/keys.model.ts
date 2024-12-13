import { t } from "elysia";

// const KeyShare = t.Object({
//     analysis_id: t.String({ description: "The analysis that is allowed to use the key share." }),
//     user_id: t.String({ description: "The user from whom the encrypted key share is." }),
//     mpc_id: t.String({ description: "The MPC engine's `client_id` for whom this encrypted key share is intended." }),
//     key_share: t.String({ description: "The encrypted key share." }),
//     exp_at: t.Number({ description: "Unix epoch timestamp in milliseconds that denotes when this key share expires." }),
// });

export const KeyShares = t.Object({
    key_share: t.Array(t.String(), { description: "List of requested key shares." })
});
