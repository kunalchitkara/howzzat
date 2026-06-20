/** Pre-configured for `pnpm lint` — avoids Expo auto-install on first run. */
module.exports = {
  extends: ["expo"],
  ignorePatterns: ["/node_modules/", "/.expo/", "/dist/"],
  env: { browser: true, es2022: true },
  globals: {
    setInterval: "readonly",
    clearInterval: "readonly",
    RequestInit: "readonly",
  },
  rules: {
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "react-hooks/exhaustive-deps": "warn",
  },
};
