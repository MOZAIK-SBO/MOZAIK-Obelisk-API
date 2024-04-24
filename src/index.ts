import { Elysia } from "elysia";
import { initControllers } from "./controllers";
import cors from "@elysiajs/cors";

export const app = new Elysia({ prefix: "/api" }).use(cors());

initControllers(app);

app.listen(process.env.PORT ?? 3000, () => {
  console.log(
    `MOZAIK-Obelisk API is running at ${app.server?.hostname}:${app.server?.port}`,
  );
});
