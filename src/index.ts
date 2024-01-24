import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { obeliskController } from "./controllers/obelisk";
import { generalController } from "./controllers/general";

const app = new Elysia();

app.use(generalController)
app.use(obeliskController);

// Documentation at /swagger endpoint
app.use(swagger({
  // provider: 'swagger-ui', // Classic Swagger UI
  provider: "scalar", // Modern UI
  documentation: {
    info: {
      title: "MOZAIK-Obelisk API",
      version: "0.1.0",
      contact: {
        email: "mozaik@esat.kuleuven.be",
        name: "MOZAIK: Scalable and Secure Data Sharing",
        url: "https://www.esat.kuleuven.be/cosic/projects/mozaik/"
      },
      description: "Stateless overarching MOZAIK-Obelisk API for storing data in Obelisk, storing keys, requesting computations, etc.",
      license: {
        name: "Apache License 2.0",
        url: "https://www.apache.org/licenses/LICENSE-2.0"
      }
    },

    tags: [
      { name: "General", description: "General API endpoints." },
      { name: "Obelisk", description: "Store data in Obelisk." },
      { name: "MPC", description: "Request computation." },
      { name: "Key store", description: "Store keys in the key store." }
    ]
  }
}));

app.listen(process.env.PORT ?? 3000, () => {
  console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
});

