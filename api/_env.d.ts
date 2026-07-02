/**
 * Minimal process.env typing for the serverless routes so the project
 * type-checks without pulling in @types/node (the game bundle stays
 * dependency-free; only the api/ runtime uses Node).
 */
declare const process: {
  env: Record<string, string | undefined>;
};
