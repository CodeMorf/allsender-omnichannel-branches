# Health check

This module is validated for AllSender's current Express/Mongoose architecture.

Production checks covered by CI and the health-hardening pass:

- Node.js 20 and 22 validation
- JavaScript syntax validation across backend and tests
- TypeScript client typecheck
- unit tests
- production dependency audit at high severity
- workspace and branch data isolation
- conversation ownership and duplicate inbound protection
- human handoff concurrency
- geolocation coverage boundaries
- branch knowledge visibility boundaries
- external-record customer binding
- external connector SSRF protection and response limits
- integration secret encryption
- branch API scopes, IP allowlists and request-rate controls
- compatibility with the AI model/API key selected in AllSender User Settings

AllSender host integration should pass `checkPermission` so the module uses the existing RolePermission/TeamPermission system.
