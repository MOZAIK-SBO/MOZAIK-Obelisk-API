import { Elysia, t } from "elysia";

const PrepareAnalysis = t.Object({
    mpcParties: t.Array(t.Object({
        mpcId: t.String(),
        keyShare: t.String()
    }), { description: "Array of MPC parties with their respective key share that need to perform the computation." }),
    expHours: t.Numeric({ description: "Amount of hours until the analysis (and key shares) expires." }),
    userPk: t.String({ description: "The user's public key." }),
    data: t.Object({
        source: t.String({ description: "The source dataset with encrypted IoT data." }),
        result: t.String({ description: "The result dataset where the result needs to be stored." }),
        from: t.Numeric({ description: "Limit analysis to events after (and including) this UTC millisecond timestamp." }),
        to: t.Numeric({ description: "Limit analysis to events before (and excluding) this UTC millisecond timestamp." })
    }),
    analysisType: t.String({ description: "The model that needs to be used in MPC." })
});


export const analysisModel = new Elysia({ name: "analysisModel" })
    .model({
        PrepareAnalysis
    });
