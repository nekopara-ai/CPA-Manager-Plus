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
