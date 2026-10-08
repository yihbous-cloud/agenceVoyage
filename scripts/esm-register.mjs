// Permet d'importer lib/*.js (imports relatifs SANS extension, pensés pour le
// bundler de Next.js) depuis un script Node autonome :
//   node --env-file=.env --import ./scripts/esm-register.mjs scripts/<script>.mjs
import { register } from "node:module";
register("./esm-loader.mjs", import.meta.url);
