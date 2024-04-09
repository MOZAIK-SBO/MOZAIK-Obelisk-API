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
    });

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
                                          ${partyEntity[index].host}/analyse`.text();

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

analysisController.get(
  "/",
  async ({ jwtDecoded }) => {
    const analysisEntities = (
      await analysisSchemaRepository
        .search()
        .where("user_id")
        .equals(jwtDecoded.client_id)
        .return.all()
    ).map((analysisEntity: Entity) => {
      return {
        ...analysisEntity,
        analysis_id: analysisEntity[EntityId]!,
      };
    });

    return analysisEntities;
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
      description: "Get list of all analysis from this user.",
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

// Called by user from dashboard
analysisController.get(
  "/status/:analysis_id",
  async ({ params: { analysis_id }, jwtDecoded }) => {
    const analysisEntity = await fetchAnalysisEntity(
      jwtDecoded.client_id,
      analysis_id,
    );

    const res: {
      statuses: {
        mpc_id: string;
        status: string;
      }[];
    } = {
      statuses: [],
    };

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
                      ${registeredParty.host}/status/${analysis_id}`.text(),
      );

      if (response.error != null) {
        throw new InternalServerError(
          JSON.stringify({ mpc_error: response.error }),
        );
      }

      res.statuses.push({
        mpc_id: party,
        status: response.type,
      });
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
            mpc_id: t.String(),
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

// Called by MPC parties
analysisController.post(
  "/data/query/:analysis_id",
  async ({ params: { analysis_id }, headers, body }) => {
    const analysisEntity = await fetchAnalysisEntity(body.user_id, analysis_id);

    return await fetch(`${process.env.OBELISK_ENDPOINT}/data/query/events`, {
      method: "POST",
      body: JSON.stringify({
        dataRange: {
          datasets: [analysisEntity.source_dataset],
          metrics: [analysisEntity.metric],
        },
        from: Math.min(...body.data_index),
        to: Math.max(...body.data_index) + 1,
      }),
      headers: {
        authorization: headers.authorization,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    })
      .then((res) => res.json())
      .then((data) => {
        return {
          user_data: data.items.map((item: any) => {
            return item.value.map.c.reduce(
              (acc: string, byte: number) =>
                acc + byte.toString(16).padStart(2, "0"),
              "",
            );
          }),
        };
      });
  },
  {
    params: t.Object({
      analysis_id: t.String(),
    }),
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

    return await fetch(`${process.env.OBELISK_ENDPOINT}/data/query/events`, {
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
    });
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

// Called by MPC parties
analysisController.post(
  "/result/:analysis_id",
  async ({ params: { analysis_id }, jwtDecoded, headers, body }) => {
    const currentTime = Date.now();

    const analysisEntity = await fetchAnalysisEntity(body.user_id, analysis_id);

    const ingestResponse = await fetch(
      `${process.env.OBELISK_ENDPOINT}/data/ingest/${analysisEntity.result_dataset}`,
      {
        method: "POST",
        body: JSON.stringify([
          {
            timestamp: currentTime,
            metric: analysisEntity.metric,
            value: {
              // TODO: We also need to store the data index (timestamp) of the encrypted data point associatiod with this result
              //       because if an analsysis consists of multiple data points, and the results are not combined yet, we can combine
              //       the related shares. Otherwise, we would not know which shares are from one computation.
              is_combined: body.is_combined != null ? body.is_combined : false,
              c_result: body.result,
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

    // Store the result timestamp
    (analysisEntity.result_timestamps as number[]).push(currentTime);
    await analysisSchemaRepository.save(analysisEntity);

    return ingestResponse;
  },
  {
    params: t.Object({
      analysis_id: t.String(),
    }),
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
