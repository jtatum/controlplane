import { createApp } from "./app.js";

const app = await createApp();

await app.listen({ port: parseInt(process.env.PORT ?? "3000"), host: "0.0.0.0" });
console.log(`Control plane API listening on ${app.server.address()?.toString()}`);
