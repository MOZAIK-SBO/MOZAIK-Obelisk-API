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
    // Make sure all the MPC parties are registered in MOZAIK
    body.parties.forEach(async party => {
        const registeredParty = await mpcPartyRepository
            .search()
            .where("mpc_id").equals(party.mpc_id).return.first();

        if (registeredParty == null) {
            throw "One or more of the provided MPC parties are not registered in MOZAIK.";
        }
    });

    const currentTime = Date.now();
    const expAt = new Date(currentTime + body.exp_hours * 60 * 60 * 1000);

    const analysisEntity = await analysisSchemaRepository.save({
        user_id: jwtDecoded.client_id,
        user_key: body.user_key,
        source_dataset: body.data.source,
        result_dataset: body.data.result,
        data_index: body.data.index,
        parties: body.parties.map((party) => party.mpc_id),
        analysis_type: body.analysis_type,
        created_at: currentTime,
        keys_exp_at: expAt.getTime()
    });

    body.parties.forEach(async party => {
        const registeredParty = (await mpcPartyRepository
            .search()
            .where("mpc_id").equals(party.mpc_id).return.first())!;

        const keyShareEntity = await keyShareRepository.save({
            analysis_id: analysisEntity[EntityId]!,
            user_id: jwtDecoded.client_id,
            mpc_id: party.mpc_id,
            key_share: party.key_share,
            exp_at: expAt.getTime(),
        });

        await keyShareRepository.expireAt((keyShareEntity[EntityId]!), expAt);

        await fetch(
            `${registeredParty.host}/analyse`,
            {
                method: "POST",
                body: JSON.stringify({
                    analysis_id: analysisEntity[EntityId]!,
                    user_id: jwtDecoded.client_id,
                    data_index: body.data.index,
                    user_key: body.user_key,
                    analysis_type: body.analysis_type
                }),
                signal: AbortSignal.timeout(5000)
                //TODO TLS / CA verification. But... does this work? Because API communicates internally with MPC engines and SSL termination is done at proxy level
            }
        );

    });

    return { analysis_id: analysisEntity[EntityId]! };
}, {
    headers: t.Object({
        authorization: t.String({ description: "JWT Bearer token." })
    }),
    body: "PrepareAnalysis",
    response: {
        200: t.Object({ analysis_id: t.String() }),
        500: t.Any()
    },
    detail: {
        tags: ["Analysis"],
        description: "Prepare an analysis. This will create an analysis ID and queue the computation on the selected MPC parties."
    }
});

analysisController.get("/status/:analysis_id",
    async ({ params: { analysis_id }, jwtDecoded }) => {
        const analysisEntity = await analysisSchemaRepository.fetch(analysis_id);

        if (analysisEntity.user_id == undefined || analysisEntity.user_id !== jwtDecoded.client_id) {
            // analysis_id does not exist or authenticated user does not have an analysis with this analysis_id
            throw new NotFoundError();
        }

        const res: {
            statuses: {
                mpc_id: string,
                status: string
            }[]
        } = {
            statuses: []
        };

        for (const party of analysisEntity.parties! as string[]) {
            const registeredParty = (await mpcPartyRepository
                .search()
                .where("mpc_id").equals(party).return.first())!;
            res.statuses.push({
                mpc_id: party,
                status: await (
                    await fetch(
                        `${registeredParty.host}/status/${analysis_id}`,
                        { signal: AbortSignal.timeout(5000) }
                    )
                ).text()
            });
        }

        return res;
    }, {
    params: t.Object({
        analysis_id: t.String()
    }),
    headers: t.Object({
        authorization: t.String({ description: "JWT Bearer token." })
    }),
    response: {
        200: t.Object({
            statuses: t.Array(
                t.Object({
                    mpc_id: t.String(),
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


