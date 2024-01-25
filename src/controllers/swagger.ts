import { swagger } from "@elysiajs/swagger";
import Elysia from "elysia";

export function initSwagger(app: Elysia) {
    // Documentation at /docs endpoint
    app.use(swagger({
        path: "/docs",
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
        },
        exclude: [
            "/docs",
            "/docs/json"
        ]
    }));
}