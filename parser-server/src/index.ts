import { buildApp } from "./server.js";

const config = {
  cacheDir: process.env.CACHE_DIR ?? "./cache",
  port: Number(process.env.PORT) || 7845,
  host: process.env.HOST ?? "0.0.0.0",
};

const app = buildApp(config);

app.listen({ port: config.port, host: config.host }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Manga Parser Server listening at ${address}`);
});
