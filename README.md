# bun-test-plan

Create a test plan for bun test runners. Used in tscircuit projects with
test matrixes to keep the CI running fast.

## Installation

```bash
npm install -g @tscircuit/bun-test-plan
```

## Usage

```bash
# Run with default settings (reads from bun-test-plan.json)
bun-test-plan

# Or specify node count via CLI
bun-test-plan --node-count 4
```

This generates a `.bun-test-plan` directory:

```
.bun-test-plan/
├── testplans/
│   ├── testplan1.txt
│   ├── testplan2.txt
│   ├── testplan3.txt
│   └── testplan4.txt
└── scripts/
    ├── run-tests-node1.sh
    ├── run-tests-node2.sh
    ├── run-tests-node3.sh
    └── run-tests-node4.sh
```

## Configuration

Configure test plan generation with `bun-test-plan.json` in your project root:

```json
{
  "nodeCount": 4,
  "globPatterns": [
    "tests/components/normal-components/**/*.test.tsx",
    "tests/components/primitive-components/**/*.test.tsx",
    "tests/repros/**/*.test.tsx",
    "tests/examples/**/*.test.tsx",
    "tests/**/*.test.{ts,tsx}"
  ]
}
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `nodeCount` | number | Number of parallel CI nodes to distribute tests across |
| `globPatterns` | string[] | Array of glob patterns to match test files (order matters!) |

## GitHub Workflow Example

```yml
name: Bun Test

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      matrix:
        node: [1, 2, 3, 4]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Generate test plans
        run: bunx @tscircuit/bun-test-plan

      - name: Run tests for node ${{ matrix.node }}
        run: |
          TESTPLAN_FILE=".bun-test-plan/testplans/testplan${{ matrix.node }}.txt"

          if [ ! -f "$TESTPLAN_FILE" ]; then
            echo "ERROR: No test plan found for node ${{ matrix.node }}"
            exit 1
          fi

          mapfile -t test_files < "$TESTPLAN_FILE"
          if [ ${#test_files[@]} -eq 0 ]; then
            echo "ERROR: No test files in plan for node ${{ matrix.node }}"
            exit 1
          fi

          echo "Running ${#test_files[@]} test files for node ${{ matrix.node }}"

          # Retry logic for segfaults and illegal instructions
          attempt=1
          while [ $attempt -le 4 ]; do
            bun test ${test_files[@]} --timeout 30000
            code=$?

            if [ $code -eq 0 ]; then
              break
            fi

            # Exit codes: 139 = segfault, 132 = illegal instruction
            if [ $code -ne 139 ] && [ $code -ne 132 ]; then
              exit $code
            fi

            if [ $attempt -eq 4 ]; then
              echo "Segmentation fault or illegal instruction detected after $attempt attempts (exit=$code)."
              exit $code
            fi

            attempt=$((attempt + 1))
            echo "Segfault (139) or illegal instruction (132) detected, retrying ($attempt/4)..."
          done

      - name: Upload Snapshot Artifacts on Failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: snapshots-node${{ matrix.node }}
          path: |
            tests/**/__snapshots__/*.diff.png
            tests/**/__snapshots__/*.snap.png
          if-no-files-found: ignore
```

## Test Plan File Format

Each `testplan{N}.txt` contains a list of test file paths, one per line:

```
tests/components/normal-components/chip.test.tsx
tests/components/normal-components/resistor.test.tsx
tests/unit/my-func.test.ts
tests/examples/basic-circuit.test.tsx
```

## Run Script Example

Each `run-tests-node{N}.sh` script handles test execution with retry logic:

```bash
#!/usr/bin/env bash

TESTPLAN_FILE=".bun-test-plan/testplans/testplan1.txt"

if [ ! -f "$TESTPLAN_FILE" ]; then
  echo "ERROR: Test plan not found: $TESTPLAN_FILE"
  exit 1
fi

mapfile -t test_files < "$TESTPLAN_FILE"

if [ ${#test_files[@]} -eq 0 ]; then
  echo "ERROR: No test files in plan"
  exit 1
fi

echo "Running ${#test_files[@]} test files..."

attempt=1
while [ $attempt -le 4 ]; do
  bun test ${test_files[@]} --timeout 30000
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
```

## Tips

- Add `.bun-test-plan/` to your `.gitignore`, they are generated prior to running tests.
- Always include a catchall pattern like `tests/**/*.test.{ts,tsx}` as the last pattern
- Adjust `nodeCount` based on your CI runner capacity and test suite size
