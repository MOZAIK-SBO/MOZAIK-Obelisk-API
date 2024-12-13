import bearer from "@elysiajs/bearer";
import { Elysia, InternalServerError, t } from "elysia";
import { batchesModel, BatchInfoEntities } from "../models/batches.model";
import { authResolver } from "../util/resolvers";
import { analysisSchemaRepository, batchInfoSchemaRepository, mpcPartyRepository } from "../redis/metadata.om";
import { Entity, EntityId } from "redis-om";
import { $ } from "bun";

export const batchesController = new Elysia({ prefix: "/batches" })
    .use(bearer())
    .use(batchesModel)
    .resolve(authResolver);


async function updateBatchStatuses() {
    let batchInfoEntities = await batchInfoSchemaRepository.search().return.all();

    for (let batch of batchInfoEntities) {
        if (batch.latest_status !== "Completed" && batch.latest_status !== "Failed") {
            const batchStatuses = new Set<string>();

            // Request status of all analyses to all mpc parties
            for (const mpc_id of batch.parties as string[]) {
                const registeredParty = (await mpcPartyRepository
                    .search()
                    .where("mpc_id")
                    .equals(mpc_id)
                    .return.first())!;

                for (const analysis_id of batch.analysis_ids as string[]) {
                    const response = JSON.parse(
                        await $`curl \
                                        --cert ${import.meta.dir}/../../certs/api.crt \
                                        --key ${import.meta.dir}/../../certs/api.key \
                                        --cacert ${import.meta.dir}/../../certs/mpc-ca.crt \
                                        -L ${registeredParty.host}/status/${analysis_id}`.text(),
                    );

                    if (response.error != null) {
                        throw new InternalServerError(
                            JSON.stringify({ mpc_error: response.error }),
                        );
                    }

                    batchStatuses.add(response.type.toLowerCase());
                }
            }

            if (batchStatuses.has("failed")) {
                batch.latest_status = "Failed";
            } else if (batchStatuses.has("queuing")) {
                batch.latest_status = "Queued";
            } else if (batchStatuses.has("running")) {
                batch.latest_status = "Running";
            } else if (batchStatuses.has("completed")) {
                batch.latest_status = "Completed";
            } else {
                batch.latest_status = "Unknown";
            }

            await batchInfoSchemaRepository.save(batch);

            // Save newest status to all analyses in batch
            for (const analysis_id of batch.analysis_ids as string[]) {
                const analysisEntity = await analysisSchemaRepository.fetch(analysis_id);
                analysisEntity.latest_status = batch.latest_status;

                await analysisSchemaRepository.save(analysisEntity);
            }
        }
    }
}

// Get all batches. This will also update the status of batches by checking the computation status of queued batches.
batchesController.get(
    "/",
    async () => {
        await updateBatchStatuses();

        let batchInfoEntities = await batchInfoSchemaRepository.search().return.all();

        return batchInfoEntities.map((batchInfoEntity: Entity) => {
            return {
                ...batchInfoEntity,
                batch_id: batchInfoEntity[EntityId]!,
            };
        });
    },
    {
        headers: t.Object({
            authorization: t.String({ description: "JWT Bearer token." }),
        }),
        response: {
            200: BatchInfoEntities,
            500: t.Any(),
        },
        detail: {
            tags: ["Batches"],
            description:
                "Get all batches. This will also fetch the latest batch status and update the status if needed.",
        },
    });

// Get all batches that are currently queued. This will also update the status of batches by checking the computation status of queued batches.
batchesController.get(
    "/queued",
    async () => {
        await updateBatchStatuses();

        let batchInfoEntities = await batchInfoSchemaRepository
            .search()
            .where("latest_status")
            .equals("Queued")
            .return.all();

        return batchInfoEntities.map((batchInfoEntity: Entity) => {
            return {
                ...batchInfoEntity,
                batch_id: batchInfoEntity[EntityId]!,
            };
        });
    },
    {
        headers: t.Object({
            authorization: t.String({ description: "JWT Bearer token." }),
        }),
        response: {
            200: BatchInfoEntities,
            500: t.Any(),
        },
        detail: {
            tags: ["Batches"],
            description:
                "Get all queued batches. This will also fetch the latest batch status and update the status if needed.",
        },
    });

batchesController.post(
    "/",
    async ({ body, jwtDecoded, set }) => {
        const user_ids: string[] = [];
        const parties: string[] = []; // Should always be `["mpc1", "mpc2", "mpc3"]` in our PoC
        const key_expirations: number[] = [];
        let first_keys_exp_at: number;
        const data_indexes: number[][] = [];

        for (const analysis_id of body.analysis_ids) {
            const analysis = await analysisSchemaRepository.fetch(analysis_id);

            user_ids.push(analysis.user_id as string);
            data_indexes.push([...(analysis.data_index as number[])]);

            // Simplification: since in our PoC we only ever consider 3 MPC parties,
            // we will not check if all the analyses have the exact same parties, since we assume this is always the case
            if (parties.length === 0) {
                parties.push(...(analysis.parties as string[]));
            }

            key_expirations.push(analysis.keys_exp_at as number);

            analysis.latest_status = "Queued";
            await analysisSchemaRepository.save(analysis);
        }

        first_keys_exp_at = key_expirations.sort()[0];

        const partyEntity: Entity[] = [];

        // Make sure all the MPC parties are registered with MOZAIK
        for (const mpc_id of parties) {
            const registeredParty = await mpcPartyRepository
                .search()
                .where("mpc_id")
                .equals(mpc_id)
                .return.first();

            if (registeredParty == null) {
                throw new InternalServerError(
                    "One or more of the provided MPC parties are not registered in MOZAIK.",
                );
            }

            partyEntity.push(registeredParty);
        }

        // Check if this is a valid batch...
        if (body.analysis_ids.length * body.analysis_data_point_count !== body.batch_size) {
            set.status = "Bad Request";

            return "400: length of analysis_ids * analysis_data_point_count should be equal to body.batch_size";
        }

        if (body.analysis_ids.length !== user_ids.length || user_ids.length !== data_indexes.length) {
            set.status = "Bad Request";

            return "400: list length mismatch (analysis_ids, user_ids, data_indexes).";
        }

        for (const data_index of data_indexes) {
            if (data_index.length !== body.analysis_data_point_count) {
                set.status = "Bad Request";

                return "400: provided amount of data points per analysis does not match actual amount of data points in at least one of the analyses.";
            }
        }

        const currentTime = Date.now();

        const batchInfoEntity = await batchInfoSchemaRepository.save({
            batch_size: body.batch_size,
            analysis_data_point_count: body.analysis_data_point_count,
            analysis_ids: body.analysis_ids,
            user_ids,
            analysis_type: body.analysis_type,
            online_only: body.online_only != null ? body.online_only : false,
            parties,
            created_at: currentTime,
            first_keys_exp_at,
            latest_status: "Queued",
        });

        for (let i = 0; i < parties.length; i++) {
            const responseText = await $`curl \
            --cert ${import.meta.dir}/../../certs/api.crt \
            --key ${import.meta.dir}/../../certs/api.key \
            --cacert ${import.meta.dir}/../../certs/mpc-ca.crt \
            -H "Content-Type: application/json" \
            -X POST \
            -d '${JSON.stringify({
                analysis_id: body.analysis_ids,
                user_id: user_ids,
                data_index: data_indexes,
                analysis_type: body.analysis_type,
                online_only: body.online_only != null ? body.online_only : false
            })}' \
            -L ${partyEntity[i].host}/analyse/`.text();

            try {
                const response = JSON.parse(responseText);

                if (response.error != null) {
                    throw new InternalServerError(
                        JSON.stringify({ batch_mpc_error: response.error }),
                    );
                }
            } catch (e: any) {
                throw new InternalServerError(
                    JSON.stringify({ error: e, raw_response: responseText }),
                );
            }
        }

        return { batch_info_id: batchInfoEntity[EntityId]! };
    },
    {
        headers: t.Object({
            authorization: t.String({ description: "JWT Bearer token." }),
        }),
        body: "SubmitBatch",
        response: {
            200: t.Object({ batch_info_id: t.String() }),
            400: t.Any(),
            500: t.Any(),
        },
        detail: {
            tags: ["Batches"],
            description:
                "Submit a new batch. This will create a batch info ID and queue the batched computation on the MPC parties of the selected analyses. The MPC parties that need to perform the computation need to be identical for all the analyses.",
        },
    }
);
