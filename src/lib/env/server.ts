import { parseEnvironment, type AppEnvironment } from "./schema";

let cachedEnvironment: AppEnvironment | undefined;

export function getServerEnvironment(): AppEnvironment {
  cachedEnvironment ??= parseEnvironment(process.env);
  return cachedEnvironment;
}
