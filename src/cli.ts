#!/usr/bin/env bun

import { parseArgs } from "util"
import { loadConfig } from "./config"
import { generateTestPlans } from "./generate-test-plan"

function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "node-count": {
        type: "string",
        short: "n",
      },
      help: {
        type: "boolean",
        short: "h",
      },
    },
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  const cwd = process.cwd()
  const config = loadConfig(cwd)

  // Override node count from CLI if provided
  if (values["node-count"]) {
    const nodeCount = parseInt(values["node-count"], 10)
    if (isNaN(nodeCount) || nodeCount < 1) {
      console.error("Error: --node-count must be a positive integer")
      process.exit(1)
    }
    config.nodeCount = nodeCount
  }

  console.log("bun-test-plan")
  console.log(`  Node count: ${config.nodeCount}`)
  console.log(`  Glob patterns: ${config.globPatterns.length}`)
  console.log("")

  generateTestPlans(config, cwd)
}

function printHelp() {
  console.log(`
bun-test-plan - Generate test plans for parallel CI execution

Usage:
  bun-test-plan [options]

Options:
  -n, --node-count <count>  Number of parallel nodes (default: from config or 4)
  -h, --help                Show this help message

Configuration:
  Create a bun-test-plan.json file in your project root:

  {
    "nodeCount": 4,
    "globPatterns": [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/**/*.test.{ts,tsx}"
    ]
  }

Output:
  .bun-test-plan/
  ├── testplans/
  │   ├── testplan1.txt
  │   ├── testplan2.txt
  │   └── ...
  └── scripts/
      ├── run-tests-node1.sh
      ├── run-tests-node2.sh
      └── ...
`)
}

main()
