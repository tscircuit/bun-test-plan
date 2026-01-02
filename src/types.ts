export interface BunTestPlanConfig {
  nodeCount: number
  globPatterns: string[]
}

export const DEFAULT_CONFIG: BunTestPlanConfig = {
  nodeCount: 4,
  globPatterns: ["tests/**/*.test.{ts,tsx}"],
}
