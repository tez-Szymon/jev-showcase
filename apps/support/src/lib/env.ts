import "server-only";
export function env() {
  // Showcase build: Jev analysis is always on. There is no manual-only mode.
  return {
    jevEnabled: true,
    apiKey: process.env.TYPESAFE_API_KEY,
    model: process.env.TYPESAFE_DEFAULT_MODEL || "jev-1.13.0",
    databasePath: process.env.DATABASE_PATH || "./data/demo.sqlite",
  };
}
