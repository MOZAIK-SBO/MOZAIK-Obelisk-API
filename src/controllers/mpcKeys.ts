import { Elysia, NotFoundError, t } from "elysia";
import { keyShareRepository } from "../redis/keyShare.om";
import { KeyShare } from "../models/keys.model";
import bearer from "@elysiajs/bearer";
import { authResolver } from "../util/resolvers";

export const mpcKeysController = new Elysia({ prefix: "/mpc/keys" })
    .use(bearer())
    .resolve(authResolver);

// Use verified JWT token's "client_id" to verify the requester and to only return a key share designated for it
mpcKeysController.get("/share/:analysis_id", async ({ params: { analysis_id }, jwtDecoded }) => {
    const share = await keyShareRepository
        .search()
        .where("analysis_id").equals(analysis_id)
        .and("mpc_id").equals(jwtDecoded.client_id).return.first();

    if (share == null) {
        throw new NotFoundError();
    }

    return share;
}, {
    params: t.Object({
        analysis_id: t.String()
    }),
    headers: t.Object({
        authorization: t.String({ description: "JWT Bearer token." })
    }),
    response: {
        200: KeyShare,
        404: t.Any(),
        500: t.Any()
    },
    detail: {
        tags: ["MPC Keys"],
        description: "Retrieve encrypted key share associated with `analysis_id` and the MPC `client_id`. The MPC engine needs to provide a valid JWT token with a `client_id` property."
    }
});
