import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export async function resolve(specifier, context, nextResolve) {
  let targetPath = null

  if (specifier.startsWith("@/")) {
    const relativePath = specifier.slice(2)
    targetPath = path.join(process.cwd(), "src", relativePath)
  } else if (specifier.startsWith(".") && context.parentURL) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL))
    targetPath = path.resolve(parentDir, specifier)
  }

  if (targetPath) {
    for (const ext of ["", ".ts", ".js", ".mjs", "/index.ts", "/index.js", "/client.js", "/client.ts"]) {
      const candidate = targetPath + ext
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return nextResolve(pathToFileURL(candidate).href, context)
      }
    }
  }

  return nextResolve(specifier, context)
}
