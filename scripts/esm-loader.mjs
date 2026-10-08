import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export async function resolve(specifier, context, next) {
  if (specifier === "next/headers") return next("next/headers.js", context);
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.(m?js|cjs|json)$/i.test(specifier)) {
    try {
      const url = new URL(specifier + ".js", context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    } catch {}
  }
  return next(specifier, context);
}
