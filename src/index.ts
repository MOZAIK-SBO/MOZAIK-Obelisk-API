import { Elysia } from "elysia";
import { initControllers } from "./controllers";
import { initModels } from "./models";

const app = new Elysia();

initModels(app);
initControllers(app);

app.listen(process.env.PORT ?? 3000, () => {
  console.log(`MOZAIK-Obelisk API is running at ${app.server?.hostname}:${app.server?.port}`);
});

