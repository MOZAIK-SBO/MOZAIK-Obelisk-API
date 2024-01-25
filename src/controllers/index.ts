import { Elysia } from "elysia";
import { obeliskController } from "./obelisk";
import { generalController } from "./general";
import { initSwagger } from "./swagger";

export function initControllers(app: Elysia) {
    initSwagger(app);

    app.use(obeliskController);
    app.use(generalController);
}
