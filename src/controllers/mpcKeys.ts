import { Elysia, NotFoundError, t } from "elysia";
import { keyShareRepository } from "../redis/keyShare.om";
import { KeyShares } from "../models/keys.model";
import bearer from "@elysiajs/bearer";
import { authResolver } from "../util/resolvers";

export const mpcKeysController = new Elysia({ prefix: "/mpc/keys" })
    .use(bearer())
    .resolve(authResolver);

// Use verified JWT token's "client_id" to verify the requester and to only return a key share designated for it
mpcKeysController.post("/share", async ({ body, jwtDecoded }) => {
    const keyShares: string[] = [];

    for (const analysis_id of body.analysis_id) {
        const share = await keyShareRepository
            .search()
            .where("analysis_id").equals(analysis_id)
            .and("mpc_id").equals(jwtDecoded.client_id).return.first();

        if (share == null) {
            throw new NotFoundError();
        }

        keyShares.push(share.key_share as string);
    }

    return {
        key_share: keyShares
    };
}, {
    headers: t.Object({
        authorization: t.String({ description: "JWT Bearer token." })
    }),
    body: t.Object({
        analysis_id: t.Array(t.String(), { description: "List of analysis IDs for which key shares are requested." }),
    }),
    response: {
        200: KeyShares,
        404: t.Any(),
        500: t.Any()
    },
    detail: {
        tags: ["MPC Keys"],
        description: "Retrieve a list of encrypted key shares associated with `analysis_id`s and the MPC `client_id`. The MPC party needs to provide a valid JWT token with a `client_id` property."
    }
});
