import { Elysia, NotFoundError, t } from "elysia";
import { keyShareRepository } from "../redis/keyShare.om";
import { KeyShare } from "../models/keys.model";
import jwt, { JwtPayload } from "jsonwebtoken";
import bearer from "@elysiajs/bearer";

export const keysController = new Elysia({ prefix: "/keys" })
    .use(bearer())
    .resolve(({ bearer, set }) => {
        let jwtDecoded: JwtPayload;

        jwt.verify(
            bearer!,
            atob(process.env.KEYCLOAK_OBELISK_PK!),
            (err, decoded) => {
                if (err) {
                    set.status = "Unauthorized";
                    throw err.toString();
                }

                if (decoded) {
                    jwtDecoded = decoded as JwtPayload;
                } else {
                    set.status = "Internal Server Error";
                    throw "Cannot decode JWT token";
                }
            }
        );

        return {
            jwtDecoded: jwtDecoded!
        }
    });


// Use verified JWT token's "client_id" to verify the requester and to only return a key share designated for it
keysController.get("/share/:analysisId", async ({ params: { analysisId }, jwtDecoded }) => {
    const share = await keyShareRepository
        .search()
        .where("analysisId").equals(analysisId)
        .and("mpcId").equals(jwtDecoded.client_id).return.first();

    if (share == null) {
        throw new NotFoundError();
    }

    return share;
}, {
    params: t.Object({
        analysisId: t.String({ description: "The key share associated with this analysis." })
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
        tags: ["Keys"],
        description: "Retrieve encrypted key share associated with `analysisId` and the MPC `client_id`. The MPC engine needs to provide a valid JWT token with a `client_id` property."
    }
});


