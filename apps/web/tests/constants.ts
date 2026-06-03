import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const TEST_DB_PATH = path.join(__dirname, "../.test-db.db");
