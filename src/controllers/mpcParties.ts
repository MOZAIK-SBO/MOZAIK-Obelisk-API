import bearer from "@elysiajs/bearer";
import { Elysia, t } from "elysia";
import { authResolver } from "../util/resolvers";
import { MpcParty, mpcPartiesModel } from "../models/mpcParties.model";
import { mpcPartyRepository } from "../redis/metadata.om";

export const mpcPartiesController = new Elysia({ prefix: "/mpc/parties" })
  .use(bearer())
  .use(mpcPartiesModel)
  .resolve(authResolver);

mpcPartiesController.get(
  "/",
  async () => {
    return await mpcPartyRepository.search().return.all();
  },
  {
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    response: {
      200: t.Array(MpcParty),
      500: t.Any(),
    },
    detail: {
      tags: ["MPC Parties"],
      description: "Get a list of all the registered MPC parties.",
    },
  },
);

mpcPartiesController.post(
  "/",
  async ({ body, set }) => {
    await mpcPartyRepository.save({
      ...body,
    });

    set.status = "No Content";
  },
  {
    headers: t.Object({
      authorization: t.String({ description: "JWT Bearer token." }),
    }),
    body: "MpcParty",
    response: {
      204: t.Undefined(),
      500: t.Any(),
    },
    detail: {
      tags: ["MPC Parties"],
      description: "Register a new MPC party.",
    },
  },
);
