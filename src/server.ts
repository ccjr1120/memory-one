import { createApp } from "./app.js";

const port = Number(process.env.MEMORY_PORT ?? 8765);
const { app } = createApp();
app.listen({ host: "127.0.0.1", port }).then(() => console.log(`Memory One listening on http://127.0.0.1:${port}`));
