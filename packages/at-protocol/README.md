# at-protocol

Shared command and message protocol definitions for ATAssistant, devices, and web adapters.

## MVP Scope

- `action-manifest.schema.json` defines the static web action manifest exposed by apps at `/.well-known/at-actions.json`.
- `src/index.ts` provides TypeScript protocol types for web apps and shared SDK code.
- Python code in ATAssistant can consume the JSON manifest directly without depending on a Node build step.

The first protocol version is `at-actions.v1`.
