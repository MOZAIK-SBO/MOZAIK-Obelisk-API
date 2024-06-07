import bearer from "@elysiajs/bearer";
import { Elysia, t } from "elysia";
import { authResolver } from "../util/resolvers";
import { EventsQueryResult, obeliskModel } from "../models/obelisk.model";
import { FheEvent } from "../mongo/fhe.schema";

export const dataController = new Elysia({ prefix: "/data" })
  .use(bearer())
  .use(obeliskModel)
  .resolve(authResolver);

dataController.post("/ingest/:datasetId",
  async ({ params: { datasetId }, headers, body, set }) => {
    if (body[0].metric.toLowerCase().includes("fhe")) {
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
