import bearer from "@elysiajs/bearer";
import { Elysia, InternalServerError, t } from "elysia";
import { authResolver } from "../util/resolvers";
import { StreamingInfo, streamingModel } from "../models/streaming.model";
import { EntityId } from "redis-om";
import { streamingInfoSchemaRepository } from "../redis/metadata.om";

export const streamingController = new Elysia({ prefix: "/streaming" })
    .use(bearer())
    .use(streamingModel)
    .resolve(authResolver);

// Get streaming info.
streamingController.get(
    "/",
    async () => {
        const streamingInfoEntity = await streamingInfoSchemaRepository.search().return.first();

        if (streamingInfoEntity == null) {
            return {
                is_streaming: false,
            }
        }

        delete streamingInfoEntity.key_shares;

        return {
            is_streaming: true,
            ...streamingInfoEntity
        };
    },
    {
        headers: t.Object({
            authorization: t.String({ description: "JWT Bearer token." }),
        }),
        response: {
            200: StreamingInfo,
            500: t.Any(),
        },
        detail: {
            tags: ["Streaming"],
            description:
                "Get streaming info. Only one streaming session can be running at the same time.",
        },
    });

// Start streaming
streamingController.post(
    "/",
    async ({ body, jwtDecoded, set }) => {
        let streamingInfoEntity = await streamingInfoSchemaRepository.search().return.first();

        if (streamingInfoEntity != null) {
            throw new InternalServerError("Already streaming. Only one streaming session can be started at a time.");
        }

        streamingInfoEntity = await streamingInfoSchemaRepository.save({
            analysis_type: body.analysis_type,
            batch_size: body.batch_size,
            key_shares: body.key_shares,
            keys_exp_at: body.keys_exp_at,
            source: body.source,
            result: body.result,
            submitted_batches: [],
            current_analysis_ids: []
        });

        const expAt = new Date(body.keys_exp_at);
        await streamingInfoSchemaRepository.expireAt(streamingInfoEntity[EntityId]!, expAt);

        set.status = "No Content";
        return;
    },
    {
        headers: t.Object({
            authorization: t.String({ description: "JWT Bearer token." }),
        }),
        body: "StartStreaming",
        response: {
            204: t.Any(),
            500: t.Any(),
        },
        detail: {
            tags: ["Streaming"],
            description:
                "Start streaming.",
        },
    }
);

// Stop streaming
streamingController.delete(
    "/",
    async ({ body, jwtDecoded, set }) => {
        const streamingInfoEntity = await streamingInfoSchemaRepository.search().return.first();

        if (streamingInfoEntity == null) {
            throw new InternalServerError("Was not streaming.");
        }

        await streamingInfoSchemaRepository.remove(streamingInfoEntity[EntityId]!);

        set.status = "No Content";
        return;
    },
    {
        headers: t.Object({
            authorization: t.String({ description: "JWT Bearer token." }),
        }),
        response: {
            204: t.Any(),
            500: t.Any(),
        },
        detail: {
            tags: ["Streaming"],
            description:
                "Stop streaming.",
        },
    }
);
