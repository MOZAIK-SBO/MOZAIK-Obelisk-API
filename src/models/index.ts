import Elysia from "elysia";
import { obeliskModel } from "./obelisk.model";

export function initModels(app: Elysia) {
    app.use(obeliskModel);
}
