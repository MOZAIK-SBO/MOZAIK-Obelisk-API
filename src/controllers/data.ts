import bearer from "@elysiajs/bearer";
import { Elysia, t } from "elysia";
import { authResolver } from "../util/resolvers";
import { EventsQueryResult, obeliskModel } from "../models/obelisk.model";
import { FheEvent } from "../mongo/fhe.schema";
import { streamingInfoSchemaRepository } from "../redis/metadata.om";
import { app } from "..";
import { metadata_client } from "../redis/metadata.client";
import { EntityId } from "redis-om";

export const dataController = new Elysia({ prefix: "/data" })
  .use(bearer())
  .use(obeliskModel)
  .resolve(authResolver);

dataController
  .post("/ingest/:datasetId",
    async ({ params: { datasetId }, headers, body, set }) => {
      if (datasetId.toLowerCase().includes("fhe")) {
        for (const event of body) {
          await (
            new FheEvent({
              ts: Date.now(),
              source: event.source,
              metric: event.metric,
              c: event.value.c
            })
          ).save();
        }

        set.status = "No Content";

        return;
      } else {
        if (body[0].timestamp == undefined) {
          body[0].timestamp = Date.now();
        }

        return await fetch(
          `${process.env.OBELISK_ENDPOINT}/data/ingest/${datasetId}`,
          {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
              "authorization": headers.authorization,
              "Content-Type": "application/json",
            }
          }
        );
      }
    }, {
    async onResponse({ set, body, headers }) {
      if (set.status != null && (set.status === 200 || set.status === 204)) {
        let streamingInfoEntity = await streamingInfoSchemaRepository.search().return.first();

        // Check if currently streaming
        if (streamingInfoEntity != null) {
          const hours_til_exp = ((streamingInfoEntity.keys_exp_at as number) - Date.now()) / (1000 * 60 * 60);

          // Prepare an analysis
          const prepared_analysis = await fetch(
            `${app.server!.url.origin}/api/analysis/mpc/prepare`,
            {
              method: "POST",
              body: JSON.stringify({
                parties: [
                  {
                    mpc_id: "mpc1",
                    key_share: (streamingInfoEntity.key_shares as string[])[0]
                  },
                  {
                    mpc_id: "mpc2",
                    key_share: (streamingInfoEntity.key_shares as string[])[1]
                  },
                  {
                    mpc_id: "mpc3",
                    key_share: (streamingInfoEntity.key_shares as string[])[2]
                  }
                ],
                exp_hours: hours_til_exp,
                data: {
                  source: streamingInfoEntity.source as string,
                  result: streamingInfoEntity.result as string,
                  metric: body[0].metric,
                  index: [body[0].timestamp]
                },
                analysis_type: streamingInfoEntity.analysis_type as string,
                user_key: "",
                invoker: "streaming"
              }),
              headers: {
                authorization: headers.authorization,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
            }).then((res) => {
              return res.json()
            });


          // Add analysis id to streaming info
          await metadata_client.json.arrAppend(
            `streaming-info:${streamingInfoEntity[EntityId]!}`,
            ".current_analysis_ids",
            prepared_analysis.analysis_id
          );

          streamingInfoEntity = await streamingInfoSchemaRepository.search().return.first();

          if (streamingInfoEntity != null) {
            // Check if we need to submit a batch
            const submitBatch = (streamingInfoEntity.current_analysis_ids as string[]).length >= (streamingInfoEntity.batch_size as number);

            if (submitBatch) {
              const batch_analysis_ids = (streamingInfoEntity.current_analysis_ids as string[]).slice(0, (streamingInfoEntity.batch_size as number));

              if (batch_analysis_ids.length === streamingInfoEntity.batch_size as number) {
                // Remove these analysis ids from streaming info
                await metadata_client.json.arrTrim(
                  `streaming-info:${streamingInfoEntity[EntityId]!}`,
                  ".current_analysis_ids",
                  (streamingInfoEntity.batch_size as number),
                  -1
                );

                // Submit batch
                setTimeout(async () => {
                  await fetch(
                    `${app.server!.url.origin}/api/batches`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        batch_size: streamingInfoEntity!.batch_size as number,
                        analysis_data_point_count: 1,
                        analysis_ids: batch_analysis_ids,
                        analysis_type: streamingInfoEntity!.analysis_type as string,
                        streaming: Array.from(
                          { length: streamingInfoEntity!.batch_size as number },
                          () => [streamingInfoEntity!.start_time as number, streamingInfoEntity!.keys_exp_at as number]
                        )
                      }),
                      headers: {
                        authorization: headers.authorization,
                        "Content-Type": "application/json",
                      },
                      signal: AbortSignal.timeout(10000),
                    }).then((res) => {
                      return res.json()
                    }).then(async (data) => {
                      // Add batch id to streaming info
                      await metadata_client.json.arrAppend(
                        `streaming-info:${streamingInfoEntity![EntityId]!}`,
                        ".submitted_batches",
                        data.batch_info_id
                      );
                    });
                }, 500);
              }

            }
          }
        }
      }
    },
    params: t.Object({
      datasetId: t.String()
    }),
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." })
    }),
    body: "MozaikIngestBatch",
    response: {
      204: t.Undefined(),
      500: t.Any()
    },
    detail: {
      tags: ["Data"],
      description: "Abstraction layer to ingest encrypted data into Obelisk."
    }
  });

dataController.post("/query",
  async ({ headers, body }) => {
    if (body.dataRange.datasets[0].toLowerCase().includes("fhe")) {
      const fheEvents = await FheEvent.find().select("ts metric source").exec();

      return {
        items: fheEvents,
        cursor: null
      }
    } else {
      return await fetch(
        `${process.env.OBELISK_ENDPOINT}/data/query/events`,
        {
          method: "POST",
          body: JSON.stringify({
            ...body,
            fields: ["timestamp", "metric", "source"]
          }),
          headers: {
            "authorization": headers.authorization,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000)
        }
      );
    }
  }, {
  headers: t.Object({
    authorization: t.String({ description: "JWT Bearer token." })
  }),
  body: "MozaikEventsQuery",
  response: {
    200: EventsQueryResult,
    500: t.Any()
  },
  detail: {
    tags: ["Data"],
    description: "Abstraction layer to query available encrypted data from Obelisk. This endpoint should be used by the user (through the dashboard) to be able to select timestamps for computation. This will only return fields: `timestamp`, `metric` and `source`."
  }
});
