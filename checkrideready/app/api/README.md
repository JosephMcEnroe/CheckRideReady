API layout:

- `app/api/sessions/*` is the single canonical session API namespace.
- `app/api/answer/submit` remains separate because it is not a sessions resource endpoint.

Conventions:

- Frontend should call only `/api/sessions/*` for session lifecycle and results.
- Keep JSON responses for both success and errors so client `JSON.parse` calls stay safe.
