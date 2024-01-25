import { Elysia } from "elysia";
import { initControllers } from "./controllers";

const app = new Elysia();

initControllers(app);

app.listen(process.env.PORT ?? 3000, () => {
  console.log(`MOZAIK-Obelisk API is running at ${app.server?.hostname}:${app.server?.port}`);
});

