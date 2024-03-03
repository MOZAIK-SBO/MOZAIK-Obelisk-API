import bearer from "@elysiajs/bearer";
import { Elysia, t } from "elysia";
import { authResolver } from "../util/resolvers";
import { obeliskModel } from "../models/obelisk.model";

export const dataController = new Elysia({ prefix: "/data" })
    .use(bearer())
    .use(obeliskModel)
    .resolve(authResolver);

dataController.post("/ingest/:datasetId",
    async ({ params: { datasetId }, headers, body }) => {
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
