package usage

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestRetiredRequestObservationsAreIgnored(t *testing.T) {
	metadata := ResponseHeaderMetadataFromRecord(map[string]any{
		"codex_turn_state": map[string]any{"request_length": 292, "request_source": "cache"},
		"response_headers": map[string]any{"X-Codex-Turn-State": "synthetic-secret", "X-Request-Id": "kept-trace"},
	}, time.Now())
	raw, err := json.Marshal(metadata)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "synthetic-secret") || strings.Contains(string(raw), "codex_turn_state") {
		t.Fatal("retired feature survived sanitization")
	}
	if !strings.Contains(string(raw), "kept-trace") {
		t.Fatal("unrelated metadata lost")
	}
}
