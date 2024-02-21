import { t } from "elysia";


export const KeyShare = t.Object({
    analysisId: t.String({ description: "The analysis that is allowed to use the key share." }),
    userId: t.String({ description: "The user from whom the encrypted key share is." }),
    mpcId: t.String({ description: "The MPC engine's `client_id` for whom this encrypted key share is intended." }),
    keyShare: t.String({ description: "The encrypted key share." }),
    expAt: t.Number({ description: "Unix epoch timestamp in milliseconds that denotes when this key share expires." }),
});

