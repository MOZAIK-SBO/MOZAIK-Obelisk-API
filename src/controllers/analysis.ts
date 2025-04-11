import { Elysia, InternalServerError, NotFoundError, t } from "elysia";
import {
  AnalysisEntities,
  MpcQueryDataResult,
  analysisModel,
} from "../models/analysis.model";
import bearer from "@elysiajs/bearer";
import {
  analysisSchemaRepository,
  mpcPartyRepository,
} from "../redis/metadata.om";
import { keyShareRepository } from "../redis/keyShare.om";
import { Entity, EntityId } from "redis-om";
import { EventsQueryResult } from "../models/obelisk.model";
import { authResolver } from "../util/resolvers";
//import https from "https";
import { $ } from "bun";
import { app } from "..";
import { metadata_client } from "../redis/metadata.client";
import { FheEvent, FheResult } from "../mongo/fhe.schema";

export const analysisController = new Elysia({ prefix: "/analysis" })
  .use(bearer())
  .use(analysisModel)
  .resolve(authResolver);

analysisController.post(
  "/mpc/prepare",
  async ({ body, jwtDecoded }) => {
    const partyEntity: Entity[] = [];

    // Make sure all the MPC parties are registered with MOZAIK
    for (const party of body.parties) {
      const registeredParty = await mpcPartyRepository
        .search()
        .where("mpc_id")
        .equals(party.mpc_id)
        .return.first();

      if (registeredParty == null) {
        throw new InternalServerError(
          "One or more of the provided MPC parties are not registered in MOZAIK.",
        );
      }

      partyEntity.push(registeredParty);
    }

    const currentTime = Date.now();
    const expAt = new Date(currentTime + body.exp_hours * 60 * 60 * 1000);

    const analysisEntity = await analysisSchemaRepository.save({
      user_id: jwtDecoded.client_id,
      user_key: body.user_key,
      source_dataset: body.data.source,
      result_dataset: body.data.result,
      metric: body.data.metric,
      data_index: body.data.index,
      result_timestamps: [],
      parties: body.parties.map((party) => party.mpc_id),
      analysis_type: body.analysis_type,
      created_at: currentTime,
      keys_exp_at: expAt.getTime(),
      latest_status: "Prepared",
      invoker: body.invoker ? body.invoker : "manual"
    });

    for (const [_, party] of body.parties.entries()) {
      const keyShareEntity = await keyShareRepository.save({
        analysis_id: analysisEntity[EntityId]!,
        user_id: jwtDecoded.client_id,
        mpc_id: party.mpc_id,
        key_share: party.key_share,
        exp_at: expAt.getTime(),
      });

      await keyShareRepository.expireAt(keyShareEntity[EntityId]!, expAt);
    }

    /* Pre-batch implementation
    for (const [index, party] of body.parties.entries()) {
      const keyShareEntity = await keyShareRepository.save({
        analysis_id: analysisEntity[EntityId]!,
        user_id: jwtDecoded.client_id,
        mpc_id: party.mpc_id,
        key_share: party.key_share,
        exp_at: expAt.getTime(),
      });

      await keyShareRepository.expireAt(keyShareEntity[EntityId]!, expAt);

      // Bug in Bun: https://github.com/oven-sh/bun/issues/6940
      // Use curl as a temp "fix"

      // await new Promise<void>(async (resolve, reject) => {
      //   const request = https.request({
      //     href: `${partyEntity[index].host}/analyse`,
      //     method: "POST",
      //     signal: AbortSignal.timeout(5000),
      //     cert: await Bun.file(`${import.meta.dir}/../../certs/api.crt`).text(),
      //     key: await Bun.file(`${import.meta.dir}/../../certs/api.key`).text(),
      //     ca: await Bun.file(
      //       `${import.meta.dir}/../../certs/mozaik-ca.crt`,
      //     ).text(),
      //     headers: {
      //       "Content-Type": "application/json",
      //     },
      //   });
      //
      //   request.on("error", (e) => {
      //     reject(e);
      //   });
      //
      //   request.write(
      //     JSON.stringify({
      //       analysis_id: analysisEntity[EntityId]!,
      //       user_id: jwtDecoded.client_id,
      //       data_index: body.data.index,
      //       user_key: body.user_key,
      //       analysis_type: body.analysis_type,
      //     }),
      //   );
      //
      //   request.end(() => resolve());
      // });

      const responseText = await $`curl \
                                          --cert ${import.meta.dir}/../../certs/api.crt \
                                          --key ${import.meta.dir}/../../certs/api.key \
                                          --cacert ${import.meta.dir}/../../certs/mpc-ca.crt \
                                          -H "Content-Type: application/json" \
                                          -X POST \
                                          -d '${JSON.stringify({
        analysis_id:
          analysisEntity[EntityId]!,
        user_id: jwtDecoded.client_id,
        data_index: body.data.index,
        user_key: body.user_key,
        analysis_type: body.analysis_type,
      })}' \
                                          -L ${partyEntity[index].host}/analyse/`.text();

      try {
        const response = JSON.parse(responseText);

        if (response.error != null) {
          throw new InternalServerError(
            JSON.stringify({ mpc_error: response.error }),
          );
        }
      } catch (e: any) {
        throw new InternalServerError(
          JSON.stringify({ error: e, raw_response: responseText }),
        );
      }
    }
    */

    return { analysis_id: analysisEntity[EntityId]! };
  },
  {
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    body: "PrepareMpcAnalysis",
    response: {
      200: t.Object({ analysis_id: t.String() }),
      500: t.Any(),
    },
    detail: {
      tags: ["Analysis"],
      description:
        "Prepare an MPC analysis. This will create an analysis ID and queue the computation on the selected MPC parties.",
    },
  },
);

analysisController.post(
  "/fhe/prepare",
  async ({ body, jwtDecoded }) => {
    const currentTime = Date.now();

    const analysisEntity = await analysisSchemaRepository.save({
      user_id: jwtDecoded.client_id,
      user_key: body.user_key,
      source_dataset: body.data.source,
      result_dataset: body.data.result,
      metric: body.data.metric,
      data_index: body.data.index,
      result_timestamps: [],
      parties: ["fhe"],
      analysis_type: body.analysis_type,
      created_at: currentTime,
      keys_exp_at: 2524608000000,
      latest_status: "Queued",
      invoker: body.invoker ? body.invoker : "manual"
    });

    const responseText = await $`curl \
                                          -H "Content-Type: application/json" \
                                          -X POST \
                                          -d '${JSON.stringify({
      analysis_id:
        analysisEntity[EntityId]!,
      user_id: jwtDecoded.client_id,
      data_index: body.data.index,
      analysis_type: body.analysis_type,
    })}' \
                                          -L http://10.10.168.50:8080/analyse/`.text();

    try {
      const response = JSON.parse(responseText);

      if (response.error != null) {
        throw new InternalServerError(
          JSON.stringify({ fhe_error: response.error }),
        );
      }
    } catch (e: any) {
      throw new InternalServerError(
        JSON.stringify({ error: e, raw_response: responseText }),
      );
    }

    return { analysis_id: analysisEntity[EntityId]! };
  },
  {
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    body: "PrepareFheAnalysis",
    response: {
      200: t.Object({ analysis_id: t.String() }),
      500: t.Any(),
    },
    detail: {
      tags: ["Analysis"],
      description:
        "Prepare a FHE analysis. This will create an analysis ID and queue the computation on the FHE computation server.",
    },
  },
);

analysisController.get(
  "/",
  async ({ jwtDecoded, headers }) => {
    let analysisEntities = await analysisSchemaRepository
      .search()
      .where("user_id")
      .equals(jwtDecoded.client_id)
      .return.all();

    analysisEntities = await Promise.all(
      analysisEntities.map(async (analysisEntity: Entity) => {
        if (
          analysisEntity.latest_status !== "Prepared" &&
          analysisEntity.latest_status !== "Completed" &&
          analysisEntity.latest_status !== "Failed"
        ) {
          const statuses = await fetch(
            `${app.server!.url.origin}/api/analysis/status/${analysisEntity[EntityId]!}`,
            {
              headers: {
                authorization: headers.authorization,
              },
              signal: AbortSignal.timeout(10000),
            },
          )
            .then((res) => {
              if (res.ok) {
                return res.json();
              } else {
                return { statuses: [{ status: "Unknown" }] };
              }
            })
            .then((res) => res.statuses);

          const analysisStatusesSet = new Set(
            statuses.map(({ status }: { status: string }) =>
              status.toLowerCase(),
            ),
          );

          // Always show the least advanced status
          if (analysisStatusesSet.has("failed")) {
            analysisEntity.latest_status = "Failed";
          } else if (analysisStatusesSet.has("queuing")) {
            analysisEntity.latest_status = "Queued";
          } else if (analysisStatusesSet.has("running")) {
            analysisEntity.latest_status = "Running";
          } else if (analysisStatusesSet.has("completed")) {
            analysisEntity.latest_status = "Completed";
          } else {
            analysisEntity.latest_status = "Unknown";
          }

          await analysisSchemaRepository.save(analysisEntity);
        }
        return analysisEntity;
      }),
    );

    return analysisEntities.map((analysisEntity: Entity) => {
      return {
        ...analysisEntity,
        analysis_id: analysisEntity[EntityId]!,
      };
    });
  },
  {
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    response: {
      200: AnalysisEntities,
      500: t.Any(),
    },
    detail: {
      tags: ["Analysis"],
      description: "Get list of all analyses from this user.",
    },
  },
);

async function fetchAnalysisEntity(
  user_id: string,
  analysis_id: string,
): Promise<Entity> {
  const analysisEntity = await analysisSchemaRepository.fetch(analysis_id);

  if (
    analysisEntity.user_id == undefined ||
    analysisEntity.user_id !== user_id
  ) {
    // analysis_id does not exist or authenticated user does not have an analysis with this analysis_id
    throw new NotFoundError();
  }

  return analysisEntity;
}

// Called by API if needed (user calls GET /analysis and that call delegates to this one if needed).
// Dashboard does not use this directly. Dashboard uses the status from the metadata database.
analysisController.get(
  "/status/:analysis_id",
  async ({ params: { analysis_id }, jwtDecoded }) => {
    const analysisEntity = await fetchAnalysisEntity(
      jwtDecoded.client_id,
      analysis_id,
    );

    const res: {
      statuses: {
        server_id: string;
        status: string;
      }[];
    } = {
      statuses: [],
    };

    if ((analysisEntity.parties as string[])[0] === "fhe") {
      // FHE analysis

      const response = JSON.parse(
        await $`curl -L http://10.10.168.50:8080/status/${analysis_id}`.text(),
      );

      if (response.error != null) {
        throw new InternalServerError(
          JSON.stringify({ fhe_error: response.error }),
        );
      }

      res.statuses.push({
        server_id: "fhe",
        status: response.type,
      });
    } else {
      // MPC analysis
      for (const party of analysisEntity.parties as string[]) {
        const registeredParty = (await mpcPartyRepository
          .search()
          .where("mpc_id")
          .equals(party)
          .return.first())!;

        // Bug in Bun: https://github.com/oven-sh/bun/issues/6940
        // Use curl as a temp "fix"

        // await new Promise<void>(async (resolve, reject) => {
        //   const request = https.request(
        //     {
        //       host: `${registeredParty.host}/status/${analysis_id}`,
        //       method: "GET",
        //       signal: AbortSignal.timeout(5000),
        //       cert: await Bun.file(
        //         `${import.meta.dir}/../../certs/api.crt`,
        //       ).text(),
        //       key: await Bun.file(
        //         `${import.meta.dir}/../../certs/api.key`,
        //       ).text(),
        //       ca: await Bun.file(
        //         `${import.meta.dir}/../../certs/mpc-ca.crt`,
        //       ).text(),
        //     },
        //     (response) => {
        //       response.on("data", (d) => {
        //         console.log(d);
        //         res.statuses.push({
        //           mpc_id: party,
        //           status: d,
        //         });
        //
        //         resolve();
        //       });
        //     },
        //   );
        //
        //   request.on("error", (e) => {
        //     console.log(e);
        //     reject(e);
        //   });
        //   request.end();
        // });

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

        res.statuses.push({
          server_id: party,
          status: response.type,
        });
      }
    }

    return res;
  },
  {
    params: t.Object({
      analysis_id: t.String(),
    }),
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    response: {
      200: t.Object({
        statuses: t.Array(
          t.Object({
            server_id: t.String(),
            status: t.String(),
          }),
        ),
      }),
      404: t.Any(),
      500: t.Any(),
    },
    detail: {
      tags: ["Analysis"],
      description: "Get the current status of the computation.",
    },
  },
);

// Called by MPC parties / FHE computation servers
analysisController.post(
  "/data/query",
  async ({ headers, body }) => {
    const res_encrypted_data_points: string[][] = [];

    const datasets: string[] = [];
    const metrics: string[] = [];
    const dataTimestamps: number[][] = [];

    let is_fhe = false;

    for (let i = 0; i < body.analysis_id.length; i++) {
      const analysisEntity = await fetchAnalysisEntity(body.user_id[i], body.analysis_id[i]);

      if ((analysisEntity.parties as string[])[0] === "fhe") {
        is_fhe = true;
      }

      datasets.push(analysisEntity.source_dataset as string);
      metrics.push(analysisEntity.metric as string);
      dataTimestamps.push(body.data_index[i]);
    }

    if (is_fhe) {
      // In the FHE case, we assume only a single analysis. This analysis can contain multiple data points though.
      return {
        user_data: [(await FheEvent
          .find()
          .where("ts").gte(Math.min(...body.data_index[0])).lt(Math.max(...body.data_index[0]) + 1)
          .select("c")
          .exec()).map(({ c }) => c)]
      };
    }

    type QueryResult = {
      timestamp: number;
      dataset: string;
      value: string;
    }

    const all_analysis_encrypted_data_points: QueryResult[] = await fetch(`${process.env.OBELISK_ENDPOINT}/data/query/events`, {
      method: "POST",
      body: JSON.stringify({
        dataRange: {
          datasets: Array.from(new Set(datasets)),
          metrics: Array.from(new Set(metrics)),
        },
        fields: ["timestamp", "dataset", "metric", "value", "source"],
        from: Math.min(...dataTimestamps.flat()),
        to: Math.max(...dataTimestamps.flat()) + 1,
      }),
      headers: {
        authorization: headers.authorization,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })
      .then((res) => {
        return res.json()
      })
      .then((data) => {
        return data.items.map((item: any) => {
          return {
            timestamp: item.timestamp,
            dataset: item.dataset,
            value: item.value.map.c.reduce(
              (acc: string, byte: number) =>
                acc + byte.toString(16).padStart(2, "0"),
              "",
            )
          }
        });
      });

    for (const [i, dataset] of datasets.entries()) {
      const enc_data_points: string[] = [];

      for (const timestamp of dataTimestamps[i]) {
        enc_data_points.push(
          all_analysis_encrypted_data_points.find(
            point => point.dataset === dataset && point.timestamp === timestamp
          )?.value || "undefined"
        )
      }

      res_encrypted_data_points.push(enc_data_points);
    }

    return {
      user_data: res_encrypted_data_points
    };
  },
  {
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    body: "FetchAnalysisData",
    response: {
      200: MpcQueryDataResult,
      500: t.Any(),
    },
    detail: {
      tags: ["Analysis"],
      description: "Fetch the encrypted data that needs to be computed.",
    },
  },
);

// Called by user from dashboard
analysisController.get(
  "/result/:analysis_id",
  async ({ params: { analysis_id }, jwtDecoded, headers }) => {
    const analysisEntity = await fetchAnalysisEntity(
      jwtDecoded.client_id,
      analysis_id,
    );

    if ((analysisEntity.result_timestamps as number[]).length < 1) {
      // No results yet
      return {
        items: [],
        cursor: null,
      };
    }

    if ((analysisEntity.parties as string[])[0] === "fhe") {
      const fheResults = await FheResult.find()
        .where("ts").gte(Math.min(...(analysisEntity.result_timestamps as number[]))).lt(Math.max(...(analysisEntity.result_timestamps as number[])) + 1)
        .exec();

      return {
        items: fheResults.map(res => {
          return {
            ...res.toObject(),
            timestamp: res.timestamp,
            value: {
              empty: false,
              map: {
                ...res.value
              }
            }
          }
        }),
        cursor: null
      }
    }
    else {
      const queryRes = await (
        await fetch(`${process.env.OBELISK_ENDPOINT}/data/query/events`, {
          method: "POST",
          body: JSON.stringify({
            dataRange: {
              datasets: [analysisEntity.result_dataset],
              metrics: [analysisEntity.metric],
            },
            from: Math.min(...(analysisEntity.result_timestamps as number[])),
            to: Math.max(...(analysisEntity.result_timestamps as number[])) + 1,
          }),
          headers: {
            authorization: headers.authorization,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000),
        })
      ).json();

      queryRes.items = queryRes.items.filter((metric_event: any) => {
        return metric_event.value.map.analysis_id === analysis_id;
      });

      return queryRes;
    }
  },
  {
    params: t.Object({
      analysis_id: t.String(),
    }),
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    response: {
      200: EventsQueryResult,
      500: t.Any(),
    },
    detail: {
      tags: ["Analysis"],
      description: "Get the encrypted result of the computation.",
    },
  },
);

// Called by MPC parties / FHE computation server
analysisController.post(
  "/result",
  async ({ jwtDecoded, headers, body, set }) => {
    for (let i = 0; i < body.analysis_id.length; i++) {
      const currentTime = Date.now();

      const analysisEntity = await fetchAnalysisEntity(body.user_id[i], body.analysis_id[i]);

      if ((analysisEntity.parties as string[])[0] === "fhe") {
        await (
          new FheResult({
            ts: currentTime,
            metric: analysisEntity.metric,
            source: jwtDecoded.client_id,

            value: {
              is_combined: true,
              c_result: body.result[i],
              analysis_id: body.analysis_id[i]
            }
          })
        ).save();

        set.status = "No Content";
      } else {
        const response = await fetch(
          `${process.env.OBELISK_ENDPOINT}/data/ingest/${analysisEntity.result_dataset}`,
          {
            method: "POST",
            body: JSON.stringify([
              {
                timestamp: currentTime,
                metric: analysisEntity.metric,
                value: {
                  // TODO: We also need to store the data index (timestamp) of the original encrypted data point associated with this result
                  //       because if an analysis consists of multiple data points, and the results are not combined yet, we can combine
                  //       the related shares. Otherwise, we would not know which shares are from which computation.
                  is_combined: body.is_combined != null ? body.is_combined : false,
                  c_result: body.result[i],
                  analysis_id: body.analysis_id[i]
                },
                source: jwtDecoded.client_id,
              },
            ]),
            headers: {
              authorization: headers.authorization,
              "Content-Type": "application/json",
            },
            signal: AbortSignal.timeout(5000),
          },
        );

        if (response?.status === 500) {
          return response;
        }
      }

      // Atomically store the result timestamp
      await metadata_client.json.arrAppend(
        `analyses:${body.analysis_id[i]}`,
        ".result_timestamps",
        currentTime,
      );
    }

    set.status = "No Content";
    return;
  },
  {
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    body: "StoreAnalysisResult",
    response: {
      204: t.Undefined(),
      500: t.Any(),
    },
    detail: {
      tags: ["Analysis"],
      description: "Store an encrypted result of the computation.",
    },
  },
);

analysisController.post(
  "/cleanup",
  async ({ set }) => {
    const analyses = await analysisSchemaRepository.search().return.all();

    const ids: string[] = [];

    for (const analysis of analyses) {
      ids.push(analysis[EntityId]!);
    }

    await analysisSchemaRepository.remove(ids);

    set.status = "No Content";
    return;
  }
  , {
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    response: {
      204: t.Undefined(),
      500: t.Any(),
    },
    detail: {
      tags: ["Analysis"],
      description: "DESTRUCTIVE! Remove all analyses to clean-up db.",
    },
  }
);
