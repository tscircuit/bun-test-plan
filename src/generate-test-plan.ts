import { writeFileSync, mkdirSync } from "fs"
import { Glob } from "bun"
import type { BunTestPlanConfig } from "./types"

export function generateTestPlans(config: BunTestPlanConfig, cwd: string) {
  const { nodeCount, globPatterns } = config

  // Get all test files using catchall pattern
  const allTestFiles = getAllTestFiles(globPatterns, cwd)
  console.log(`Found ${allTestFiles.length} total test files`)

  if (allTestFiles.length === 0) {
    console.warn("No test files found matching the glob patterns")
    return
  }

  // Track which files have been claimed
  const claimedFiles = new Set<string>()
  const nodePlans: string[][] = Array.from({ length: nodeCount }, () => [])

  // Process each glob pattern in order (first pattern claims files)
  for (let patternIdx = 0; patternIdx < globPatterns.length; patternIdx++) {
    const pattern = globPatterns[patternIdx]
    if (!pattern) continue

    // Find files matching this pattern
    const glob = new Glob(pattern)
    const matchingFiles = Array.from(glob.scanSync({ cwd })).sort()

    // Filter to only unclaimed files
    const unclaimedMatches = matchingFiles.filter((f) => !claimedFiles.has(f))

    console.log(`\nPattern ${patternIdx + 1}: ${pattern}`)
    console.log(
      `  Matched ${matchingFiles.length} files, ${unclaimedMatches.length} unclaimed`,
    )

    // Distribute unclaimed files across nodes in round-robin fashion
    for (let idx = 0; idx < unclaimedMatches.length; idx++) {
      const file = unclaimedMatches[idx]
      if (!file) continue
      const nodeIdx = idx % nodeCount
      const nodePlan = nodePlans[nodeIdx]
      if (nodePlan) {
        nodePlan.push(file)
        claimedFiles.add(file)
      }
    }
  }

  // Check for any unclaimed files (shouldn't happen with catchall)
  const unclaimedFiles = allTestFiles.filter((f) => !claimedFiles.has(f))
  if (unclaimedFiles.length > 0) {
    console.warn(
      `\nWarning: ${unclaimedFiles.length} files were not claimed by any pattern:`,
    )
    for (const f of unclaimedFiles) {
      console.warn(`  - ${f}`)
    }
  }

  // Create output directories
  const testPlansDir = ".bun-test-plan/testplans"
  const scriptsDir = ".bun-test-plan/scripts"
  mkdirSync(testPlansDir, { recursive: true })
  mkdirSync(scriptsDir, { recursive: true })

  // Write test plans and scripts
  console.log(`\nWriting test plans for ${nodeCount} nodes...`)
  for (let i = 0; i < nodeCount; i++) {
    const nodeNum = i + 1
    const nodePlan = nodePlans[i]
    if (!nodePlan) continue

    // Write test plan file
    const planFile = `${testPlansDir}/testplan${nodeNum}.txt`
    const planContent = nodePlan.join("\n")
    writeFileSync(planFile, planContent, "utf8")
    console.log(`  ${planFile}: ${nodePlan.length} tests`)

    // Write run script
    const scriptFile = `${scriptsDir}/run-tests-node${nodeNum}.sh`
    const scriptContent = generateRunScript(nodeNum)
    writeFileSync(scriptFile, scriptContent, { mode: 0o755 })
  }

  console.log(`\nTest plans generated successfully!`)
  console.log(`   Total files: ${allTestFiles.length}`)
  console.log(`   Claimed: ${claimedFiles.size}`)
  console.log(`   Unclaimed: ${unclaimedFiles.length}`)
}

function getAllTestFiles(globPatterns: string[], cwd: string): string[] {
  const allFiles = new Set<string>()

  for (const pattern of globPatterns) {
    const glob = new Glob(pattern)
    for (const file of glob.scanSync({ cwd })) {
      allFiles.add(file)
    }
  }

  return Array.from(allFiles).sort()
}

function generateRunScript(nodeNum: number): string {
  return `#!/usr/bin/env bash

TESTPLAN_FILE=".bun-test-plan/testplans/testplan${nodeNum}.txt"

if [ ! -f "$TESTPLAN_FILE" ]; then
  echo "ERROR: Test plan not found: $TESTPLAN_FILE"
  exit 1
fi

mapfile -t test_files < "$TESTPLAN_FILE"

if [ \${#test_files[@]} -eq 0 ]; then
  echo "ERROR: No test files in plan"
  exit 1
fi

echo "Running \${#test_files[@]} test files..."

attempt=1
while [ $attempt -le 4 ]; do
  bun test \${test_files[@]} --timeout 30000
  code=$?

  if [ $code -eq 0 ]; then
    exit 0
  fi

  # Retry only on segfault (139) or illegal instruction (132)
  if [ $code -ne 139 ] && [ $code -ne 132 ]; then
    exit $code
  fi

  if [ $attempt -eq 4 ]; then
    echo "Failed after $attempt attempts (exit=$code)"
    exit $code
  fi

  attempt=$((attempt + 1))
  echo "Retrying ($attempt/4)..."
done
`
}
