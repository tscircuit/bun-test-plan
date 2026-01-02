import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { type BunTestPlanConfig, DEFAULT_CONFIG } from "./types"

export function loadConfig(cwd: string): BunTestPlanConfig {
  const configPath = join(cwd, "bun-test-plan.json")

  if (!existsSync(configPath)) {
    console.log("No bun-test-plan.json found, using default config")
    return DEFAULT_CONFIG
  }

  try {
    const configContent = readFileSync(configPath, "utf8")
    const userConfig = JSON.parse(configContent) as Partial<BunTestPlanConfig>

    return {
      nodeCount: userConfig.nodeCount ?? DEFAULT_CONFIG.nodeCount,
      globPatterns: userConfig.globPatterns ?? DEFAULT_CONFIG.globPatterns,
    }
  } catch (error) {
    console.error(`Error reading config file: ${error}`)
    console.log("Using default config")
    return DEFAULT_CONFIG
  }
}
