import { Elysia, t } from "elysia";

const PrepareAnalysis = t.Object({
    parties: t.Array(t.Object({
        mpc_id: t.String(),
        key_share: t.String()
    }), { description: "Array of MPC parties with their respective key share that need to perform the computation." }),
    exp_hours: t.Numeric({ description: "Amount of hours until the analysis (and key shares) expires." }),
    user_key: t.String({ description: "The user's public key." }),
    data: t.Object({
        source: t.String({ description: "The source dataset with encrypted IoT data." }),
        result: t.String({ description: "The result dataset where the result needs to be stored." }),
        index: t.Array(t.Numeric(), { description: "Array of timestamps of the data points." })
    }),
    analysis_type: t.String({ description: "The model that needs to be used in MPC." })
});


export const analysisModel = new Elysia({ name: "analysisModel" })
    .model({
        PrepareAnalysis
    });
