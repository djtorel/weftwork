# State file fields

`specs/state.yaml` holds the workflow state of this repository. The engine
writes only the fields marked `engine`, through `setStateField` in
`src/state-fields.ts`. It refuses every other key and keeps it byte for
byte. Each engine field is text or null, on one line, of 200 characters or
fewer. The engine does not check id patterns or phase names.

Read and set the engine fields with the state CLI:

```bash
echo '{"op":"get"}' | node src/state-cli.ts
echo '{"op":"set","key":"active_story","value":"e08s02"}' | node src/state-cli.ts
```

| Key | Type | Written by |
| --- | ---- | ---------- |
| `active_flow` | text or null | engine |
| `active_epic` | text or null | engine |
| `active_story` | text or null | engine |
| `phase` | text or null | engine |
| `vcs.branch` | text or null | engine |
| `vcs.kind` | text | owner |
| `workflow_mode` | text | owner |
| `test_plan` | text | owner |
| `handoff` | mapping | owner (the engine from e08s03) |
| `waivers` | list | owner |
| `metrics` | mapping | global scripts (`bp-timing.sh`) |

A test (`src/state-fields.test.ts`) fails when the `engine` rows of this
table and `stateFields` in the code differ.
