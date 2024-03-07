import { Elysia, t } from "elysia";

export const MpcParty = t.Object({
  mpc_id: t.String(),
  mpc_key: t.String(),
  host: t.String(),
  region: t.String(),
});

export const mpcPartiesModel = new Elysia({ name: "mpcPartiesModel" }).model({
  MpcParty,
});
