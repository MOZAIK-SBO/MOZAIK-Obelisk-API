import { Elysia, NotFoundError, t } from "elysia";
import { keyShareRepository } from "../redis/keyShare.om";
import { EntityId } from "redis-om";
import { KeyShare, keysModel } from "../models/keys.model";
import jwt, { JwtPayload } from "jsonwebtoken";
import bearer from "@elysiajs/bearer";

/*
 * Redis ACL commands
 * 
 * acl setuser mozaik-api on >mozaik-PoC-keystore-pass +@all -@dangerous ~key-share*
 * acl setuser mozaik-admin on >mozaik-PoC-admin-pass +@all ~*
 * acl setuser default off
 */


export const keysController = new Elysia({ prefix: "/keys" })
    .use(bearer())
    .use(keysModel)
    .resolve(({ bearer, set }) => {
        let jwtDecoded: JwtPayload;

        jwt.verify(
            bearer!,
            atob(process.env.KEYCLOAK_PK!),
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
keysController.get("/share/:userId", async ({ params: { userId }, jwtDecoded }) => {
    const share = await keyShareRepository
        .search()
        .where("userId").equals(userId)
        .and("mpcId").equals(jwtDecoded.client_id).return.first();

    if (share == null) {
        throw new NotFoundError();
    }

    return share;
}, {
    params: t.Object({
        userId: t.String({ description: "The key share from this user." })
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
        description: "Retrieve encrypted key share associated with `userId` and the MPC `client_id`. The MPC engine needs to provide a valid JWT token with a `client_id` property."
    }
});

keysController
    .post("/share", async ({ body, jwtDecoded, set }) => {
        const shareCount = await keyShareRepository
            .search()
            .where("userId").equals(jwtDecoded.client_id)
            .and("mpcId").equals(body.mpcId).return.count();

        if (shareCount > 0) {
            throw `Key share for MPC engine '${body.mpcId}' and user '${jwtDecoded.client_id}' already exists.`;
        }

        const expAt = new Date(Date.now() + body.expHours * 60 * 60 * 1000);

        const keyShareEntity = await keyShareRepository.save({
            userId: jwtDecoded.client_id,
            mpcId: body.mpcId,
            mpcPk: body.mpcPk,
            expAt: expAt.getTime(),
            share: body.share
        });

        await keyShareRepository.expireAt((keyShareEntity[EntityId]!), expAt);

        set.status = "No Content";
    }, {
        headers: t.Object({
            authorization: t.String({ description: "JWT Bearer token." })
        }),
        body: "StoreKey",
        response: {
            204: t.Undefined(),
            500: t.Any()
        },
        detail: {
            tags: ["Keys"],
            description: "Store encrypted key share for MPC engine with `mpcId`. The user needs to provide a valid JWT token with a `client_id` property."
        }
    });

