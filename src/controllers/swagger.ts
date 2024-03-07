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
            servers: [
                {
                    url: "https://mozaik.ilabt.imec.be"
                }
            ],
            tags: [
                { name: "General", description: "General API endpoints." },
                { name: "Data", description: "Store and query data from Obelisk." },
                { name: "Analysis", description: "Request computation." },
                { name: "MPC Parties", description: "Query and register MPC parties." },
                { name: "MPC Keys", description: "Retrieve MPC key shares from the key store." },
                { name: "FHE Keys", description: "Manage FHE keys in the key store." },
                { name: "Obelisk", description: "Manage data in Obelisk." },
            ]
        },
        exclude: [
            "/api/docs",
            "/api/docs/json"
        ]
    }));
}
