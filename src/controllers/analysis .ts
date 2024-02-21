import { Elysia, NotFoundError, t } from "elysia";
import { analysisModel } from "../models/analysis.model";
import bearer from "@elysiajs/bearer";
import jwt, { JwtPayload } from "jsonwebtoken";
import { analysisSchemaRepository, mpcPartyRepository } from "../redis/metadata.om";
import { keyShareRepository } from "../redis/keyShare.om";
import { EntityId } from "redis-om";

export const analysisController = new Elysia({ prefix: "/analysis" })
    .use(bearer())
    .use(analysisModel)
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


analysisController.post("/prepare", async ({ body, jwtDecoded }) => {
    const currentTime = Date.now();
    const expAt = new Date(currentTime + body.expHours * 60 * 60 * 1000);

    const analysisEntity = await analysisSchemaRepository.save({
        userId: jwtDecoded.client_id,
        userPk: body.userPk,
        sourceDataset: body.data.source,
        resultDataset: body.data.result,
        fromTimestamp: body.data.from,
        toTimestamp: body.data.to,
        parties: body.mpcParties.map((party) => party.mpcId),
        analysisType: body.analysisType,
        createdAt: currentTime,
        keysExpAt: expAt.getTime()
    });

    body.mpcParties.forEach(async party => {
        const keyShareEntity = await keyShareRepository.save({
            analysisId: analysisEntity[EntityId]!,
            userId: jwtDecoded.client_id,
            mpcId: party.mpcId,
            keyShare: party.keyShare,
            expAt: expAt.getTime(),
        });

        await keyShareRepository.expireAt((keyShareEntity[EntityId]!), expAt);

        const registeredParty = await mpcPartyRepository
            .search()
            .where("mpcId").equals(party.mpcId).return.first();

        if (registeredParty == null) {
            throw "One or more of the provided MPC parties is not registered in MOZAIK.";
        }

        // TODO: Kan enkel getest worden als COSIC MPC engine PoC klaar is
        await fetch(
            `${registeredParty.host}/analyse`,
            {
                method: "POST",
                body: JSON.stringify({
                    analysisId: analysisEntity[EntityId]!,
                    userId: jwtDecoded.client_id,
                    dataFrom: body.data.from,
                    dataTo: body.data.to,
                    userPk: body.userPk,
                    analysisType: body.analysisType
                }),
                //TODO? // headers: { "authorization": ...}
            }
        );

    });

    return { analysisId: analysisEntity[EntityId]! };
}, {
    headers: t.Object({
        authorization: t.String({ description: "JWT Bearer token." })
    }),
    body: "PrepareAnalysis",
    response: {
        200: t.Object({ analysisId: t.String() }),
        500: t.Any()
    },
    detail: {
        tags: ["Analysis"],
        description: "Prepare an analysis. This will create an analysis ID and queue the computation on the selected MPC parties."
    }
});

analysisController.get("/status/:analysisId",
    async ({ params: { analysisId }, jwtDecoded, set }) => {
        const analysisEntity = await analysisSchemaRepository.fetch(analysisId);

        if (analysisEntity.userId == undefined || analysisEntity.userId !== jwtDecoded.client_id) {
            // analysisId does not exist or authenticated user does not have an analysis with this analysisId
            throw new NotFoundError();
        }

        const res: {
            statuses: {
                mpcId: string,
                status: string
            }[]
        } = {
            statuses: []
        };

        for (const party of analysisEntity.parties! as string[]) {
            const registeredParty = (await mpcPartyRepository
                .search()
                .where("mpcId").equals(party).return.first())!;
            res.statuses.push({
                mpcId: party,
                status: await (await fetch(`${registeredParty.host}/status/${analysisId}`)).text()
            });
        }

        return res;
    }, {
    params: t.Object({
        analysisId: t.String()
    }),
    headers: t.Object({
        authorization: t.String({ description: "JWT Bearer token." })
    }),
    response: {
        200: t.Object({
            statuses: t.Array(
                t.Object({
                    mpcId: t.String(),
                    status: t.String()
                })
            )
        }),
        403: t.Any(),
        404: t.Any(),
        500: t.Any()
    },
    detail: {
        tags: ["Analysis"],
        description: "Get the current status of the computation."
    }
});


