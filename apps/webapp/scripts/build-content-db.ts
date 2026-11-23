// `pnpm run build:db`: build public/content.sqlite from db/schema.sql and db/seed/*.sql.
import { buildContentDb } from "./content-db.ts";

console.log(await buildContentDb());
