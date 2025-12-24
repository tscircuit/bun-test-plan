# bun-test-plan

Create a test plan for bun test runners. Used in tscircuit projects with
test matrixes to keep the CI running fast.

```bash
npm install -g @tscircuit/bun-test-plan

# Run
bun-test-plan --node-count 2

# Generates `.bun-test-plan` directory
# .bun-test-plan/scripts/run-tests-node1.sh
# .bun-test-plan/testplans/testplan1.txt
# ...
```

Here's an example github workflow using `bun-test-plan`

```yml
TODO
```


You can configure the test plan generation with `bun-test-plan.json`

```json
{
  "nodeCount": 2,
  "
}
```

Here's an example test plan file:

```
tests/features/feature01.test.ts
tests/unit/my-func.test.ts
```

Here's an example `run-tests-*.sh` script:

```bash
#!/usr/env bash

bun test $(...)
```


## Tips

- You do not commit the test plans to github, they are generated prior to running tests.
