import Elysia from "elysia";
import { obeliskModel } from "./obelisk.model";
import { keysModel } from "./keys.model";

export function initModels(app: Elysia) {
    app.use(obeliskModel);
    app.use(keysModel);
}
