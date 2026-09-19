# Codex request ticket monitoring

The ticket badge describes the outbound request attempt, not the credential's
current cache entry. A cached ticket may be sent even when the upstream response
does not return another `X-Codex-Turn-State` header.

## CPA queue contract

New CPA producers may include this optional object in each usage event:

```json
{"codex_turn_state":{"request_length":292,"request_source":"cache"}}
```

- `cache`: the observed outgoing header was injected from the matching
  credential/model bucket; length must be positive.
- `passthrough`: the observed outgoing header was not cache-injected; length must
  be positive. It may originate from a caller or configured header.
- `none`: the outbound headers were observed and contained no ticket; length is
  explicitly zero.
- Absent: no request observation was supplied, including historical records.

These are transport observations, not proof that the upstream accepted a ticket
or that it remains valid. WebSocket implementations must attribute the physical
connection's actual handshake, not a newly constructed but unsent header.
Such observations include `"request_scope":"websocket_handshake"`; omitted scope
means HTTP. CPAMP labels these as connection injection/passthrough/absence and
explains that reused sockets retain the original handshake observation. Unknown
scope values are ignored rather than presented as successful injection.

## CPAMP storage and API

CPAMP stores the observation inside its existing `response_metadata_json` column
and serves it at `response_metadata.codex_turn_state`. The column name is retained
for compatibility; the request fields are independent of `response_length`.
No schema migration, encryption layer, or historical backfill is introduced.

`response_length` continues to mean only the observed response-header length.
Response-only legacy records are never marked as injected. Missing request data
is displayed as unknown; explicit zero is displayed as no ticket. Cache injection
and passthrough have distinct labels, and response length is shown separately.

New metadata contains only byte length, source and optional scope, not ticket contents. Invalid,
incomplete, inconsistent, or oversized request observations are ignored. Existing
authentication and export sanitization policies are unchanged.

## Verification

Tests cover request-only cache observations with no response ticket, passthrough,
explicit none, response-only legacy data, independent request/response lengths,
malformed observations, JSONL round trips, credential attribution, SQLite
ingestion, monitoring projections, authenticated API reads and frontend labels.
