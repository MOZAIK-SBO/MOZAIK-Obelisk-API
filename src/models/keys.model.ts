import { Elysia, t } from "elysia";

const StoreKey = t.Object({
    mpcId: t.String({ description: "MPC `client_id`" }),
    mpcPk: t.String({ description: "MPC public key" }),
    expHours: t.Numeric({ description: "Amount of hours until the key share expires." }),
    share: t.String({ description: "The encrypted key share for the authenticated user and `mpcId`." }),
});

export const KeyShare = t.Object({
    userId: t.String({ description: "The user from whom the encrypted key share is." }),
    mpcId: t.String({ description: "The MPC engine's `client_id` for whom this encrypted key share is intended." }),
    mpcPk: t.String({ description: "The public key of the MPC engine. The key share was encrypted using this public key." }),
    expAt: t.Number({ description: "Unix epoch timestamp in milliseconds that denotes when this key share expires." }),
    share: t.String({ description: "The encrypted key share." }),
});

export const keysModel = new Elysia({ name: "keysModel" })
    .model({
        StoreKey
    });
