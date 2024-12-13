import { Elysia } from "elysia";
import { obeliskController } from "./obelisk";
import { generalController } from "./general";
import { initSwagger } from "./swagger";
import { mpcKeysController } from "./mpcKeys";
import { analysisController } from "./analysis";
import { dataController } from "./data";
import { mpcPartiesController } from "./mpcParties";
import { batchesController } from "./batches";

export function initControllers(app: Elysia<any>) {
  initSwagger(app);

  app.use(generalController);
  app.use(obeliskController);
  app.use(dataController);
  app.use(mpcKeysController);
  app.use(analysisController);
  app.use(batchesController);
  app.use(mpcPartiesController);
}
