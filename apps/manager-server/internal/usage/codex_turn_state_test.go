package usage

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestCodexTurnStateResponseLengthFromUsageHeaders(t *testing.T) {
	for _, length := range []int{292, 312, 428} {
		t.Run(fmt.Sprint(length), func(t *testing.T) {
			state := "gAAAAA" + strings.Repeat("a", length-6)
			raw, err := json.Marshal(map[string]any{
				"timestamp": "2026-09-19T09:00:00Z",
				"provider":  "codex", "auth_index": "credential-a", "model": "model-a",
				"failed": length == 312,
				"response_headers": map[string]any{
					"x-CoDeX-tUrN-sTaTe": []string{"  " + state + "  "},
					"X-Request-ID":       []string{"trace-a"},
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			event, err := NormalizeRaw(raw)
			if err != nil {
				t.Fatal(err)
			}
			if event.AuthIndex != "credential-a" || event.Model != "model-a" {
				t.Fatal("event identity lost")
			}
			metadata := ResponseHeaderMetadataFromJSON(event.ResponseMetadataJSON)
			if metadata == nil || metadata.CodexTurnState == nil || metadata.CodexTurnState.ResponseLength != length {
				t.Fatalf("response length missing after metadata roundtrip: %s", event.ResponseMetadataJSON)
			}
			if metadata.Trace == nil || metadata.Trace.PrimaryTraceID != "trace-a" {
				t.Fatal("trace metadata lost")
			}
			if strings.Contains(event.ResponseMetadataJSON, state) {
				t.Fatal("UI metadata contains the full header instead of its length")
			}
		})
	}
}

func TestCodexTurnStateAbsentAndImportedMetadata(t *testing.T) {
	base := time.Unix(1_790_000_000, 0)
	for _, value := range []any{nil, "", "  ", []any{}, "[redacted]", map[string]any{"length": 292}} {
		metadata := ParseResponseHeaderMetadata(map[string]any{"X-Codex-Turn-State": value}, base)
		if metadata != nil {
			t.Fatalf("unobserved ticket produced metadata: %#v", metadata)
		}
	}
	for _, raw := range []string{`{"codex_turn_state":{"response_length":0}}`, `{"codex_turn_state":{"response_length":-1}}`} {
		if ResponseHeaderMetadataFromJSON(raw) != nil {
			t.Fatal("invalid imported length accepted")
		}
	}
	state := "gAAAAA" + strings.Repeat("b", 286)
	raw, err := json.Marshal(map[string]any{"response_headers": map[string]any{"X-Codex-Turn-State": state}})
	if err != nil {
		t.Fatal(err)
	}
	metadata := ResponseHeaderMetadataFromRecord(map[string]any{
		"response_metadata": map[string]any{"trace": map[string]any{"primary_trace_id": "old-trace"}},
		"raw_json":          string(raw),
	}, base)
	if metadata == nil || metadata.CodexTurnState == nil || metadata.CodexTurnState.ResponseLength != 292 || metadata.Trace == nil || metadata.Trace.PrimaryTraceID != "old-trace" {
		t.Fatal("import did not enrich existing metadata from the same response")
	}
}

func TestCodexTurnStateRequestObservationWithoutResponseHeader(t *testing.T) {
	for _, tc := range []struct {
		source string
		length int
	}{{"cache", 292}, {"passthrough", 312}, {"none", 0}} {
		t.Run(tc.source, func(t *testing.T) {
			raw := fmt.Sprintf(`{"timestamp":"2026-09-19T12:00:00Z","provider":"codex","model":"test-model","auth_index":"account-a","codex_turn_state":{"request_length":%d,"request_source":%q}}`, tc.length, tc.source)
			event, err := NormalizeRaw([]byte(raw))
			if err != nil {
				t.Fatal(err)
			}
			metadata := ResponseHeaderMetadataFromJSON(event.ResponseMetadataJSON)
			assertRequestTurnState(t, metadata, tc.length, tc.source, 0)
			if event.AuthIndex != "account-a" {
				t.Fatal("credential attribution lost")
			}
			// Export/import must preserve explicit zero and source, without inventing
			// a response header or retaining plaintext ticket material.
			exported, err := json.Marshal(event)
			if err != nil {
				t.Fatal(err)
			}
			result, err := ParseImportPayload(exported)
			if err != nil || len(result.Events) != 1 {
				t.Fatalf("import failed: %v", err)
			}
			assertRequestTurnState(t, result.Events[0].ResponseMetadata, tc.length, tc.source, 0)
		})
	}
}

func TestCodexTurnStateRequestAndResponseAreIndependent(t *testing.T) {
	base := time.Date(2026, 9, 19, 12, 0, 0, 0, time.UTC)
	response := "gAAAAA" + strings.Repeat("b", 306)
	request := map[string]any{"request_length": 292, "request_source": "cache"}
	raw, err := json.Marshal(map[string]any{"codex_turn_state": request})
	if err != nil {
		t.Fatal(err)
	}
	for _, record := range []map[string]any{
		{"codex_turn_state": request, "response_headers": map[string]any{"X-Codex-Turn-State": response}},
		{"raw_json": string(raw), "response_metadata": map[string]any{"codex_turn_state": map[string]any{"response_length": 312}}},
		{"codex_turn_state": request, "response_metadata": map[string]any{"codex_turn_state": map[string]any{"response_length": 312}}},
	} {
		metadata := ResponseHeaderMetadataFromRecord(record, base)
		assertRequestTurnState(t, metadata, 292, "cache", 312)
		derived := DeriveResponseHeaderMetadata(metadata)
		if strings.Contains(derived.MetadataJSON, response) {
			t.Fatal("plaintext response ticket leaked into metadata")
		}
	}
	// A new explicit 'none' on the same record replaces the whole request
	// observation, including the prior nonzero length, but keeps the response.
	metadata := ResponseHeaderMetadataFromRecord(map[string]any{
		"response_metadata": map[string]any{"codex_turn_state": map[string]any{
			"request_length": 292, "request_source": "cache", "response_length": 312, "request_scope": "websocket_handshake",
		}},
		"codex_turn_state": map[string]any{"request_length": 0, "request_source": "none"},
	}, base)
	assertRequestTurnState(t, metadata, 0, "none", 312)
	if metadata.CodexTurnState.RequestScope != "" {
		t.Fatal("HTTP observation inherited stale websocket scope")
	}
	metadata = ResponseHeaderMetadataFromRecord(map[string]any{
		"codex_turn_state": map[string]any{"request_length": 292, "request_source": "cache", "request_scope": "websocket_handshake"},
	}, base)
	assertRequestTurnState(t, metadata, 292, "cache", 0)
	if ResponseHeaderMetadataFromJSON(DeriveResponseHeaderMetadata(metadata).MetadataJSON).CodexTurnState.RequestScope != "websocket_handshake" {
		t.Fatal("websocket handshake scope lost in storage")
	}
}

func TestCodexTurnStateRejectsIncompleteOrInvalidRequestObservations(t *testing.T) {
	for _, observation := range []string{
		`null`, `{}`, `{"request_length":292}`, `{"request_source":"cache"}`,
		`{"request_length":0,"request_source":"cache"}`,
		`{"request_length":292,"request_source":"none"}`,
		`{"request_length":-1,"request_source":"passthrough"}`,
		`{"request_length":65537,"request_source":"cache"}`,
		`{"request_length":292.5,"request_source":"cache"}`,
		`{"request_length":"292","request_source":"cache"}`,
		`{"request_length":292,"request_source":"untrusted"}`,
		`{"request_length":292,"request_source":"cache","request_scope":"invented"}`,
		`{"response_length":292}`,
	} {
		t.Run(observation, func(t *testing.T) {
			var raw any
			if err := json.Unmarshal([]byte(observation), &raw); err != nil {
				t.Fatal(err)
			}
			metadata := ResponseHeaderMetadataFromRecord(map[string]any{
				"codex_turn_state":  raw,
				"response_metadata": map[string]any{"codex_turn_state": map[string]any{"response_length": 312}},
			}, time.Now())
			if metadata == nil || metadata.CodexTurnState == nil || metadata.CodexTurnState.ResponseLength != 312 ||
				metadata.CodexTurnState.RequestLength != nil || metadata.CodexTurnState.RequestSource != "" {
				t.Fatal("invalid request data must not claim injection or discard independent response data")
			}
		})
	}
	// Old response-only events remain unknown on the request side.
	metadata := ResponseHeaderMetadataFromJSON(`{"codex_turn_state":{"response_length":292}}`)
	if metadata == nil || metadata.CodexTurnState.RequestLength != nil || metadata.CodexTurnState.RequestSource != "" {
		t.Fatal("old response-only event was mislabeled as injected")
	}
}

func assertRequestTurnState(t *testing.T, metadata *ResponseHeaderMetadata, length int, source string, responseLength int) {
	t.Helper()
	if metadata == nil || metadata.CodexTurnState == nil {
		t.Fatal("ticket metadata missing")
	}
	state := metadata.CodexTurnState
	if state.RequestLength == nil || *state.RequestLength != length || state.RequestSource != source || state.ResponseLength != responseLength {
		t.Fatalf("incorrect request/response observation: %+v", state)
	}
}
