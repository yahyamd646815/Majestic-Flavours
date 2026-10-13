// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/ is Deno Edge Function source, not React Native — its globals
    // and jsr:/npm: imports do not exist in this project's lint or TypeScript
    // scope (tsconfig.json excludes it for the same reason).
    ignores: ["dist/*", "supabase/**"],
  }
]);
