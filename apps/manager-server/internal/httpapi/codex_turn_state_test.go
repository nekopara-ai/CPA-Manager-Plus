package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/seakee/cpa-manager-plus/apps/manager-server/internal/testutil"
	"github.com/seakee/cpa-manager-plus/apps/manager-server/internal/usage"
)

func TestRequestTicketImportMonitoringAndExportContract(t *testing.T) {
	handler := newTestHandler(t, "http://example.test", true)
	base := time.Date(2026, 9, 19, 12, 0, 0, 0, time.UTC)
	observations := []struct {
		source string
		length int
	}{{"cache", 292}, {"passthrough", 312}, {"none", 0}, {"", -1}}
	var lines []string
	for i, observation := range observations {
		record := map[string]any{
			"timestamp": base.Add(time.Duration(i) * time.Second).Format(time.RFC3339),
			"provider":  "codex", "model": "fixture-model", "auth_index": fmt.Sprintf("credential-%d", i),
			"tokens": map[string]int{"input_tokens": 1, "total_tokens": 1},
		}
		if observation.source != "" {
			record["codex_turn_state"] = map[string]any{"request_length": observation.length, "request_source": observation.source}
		} else {
			// A legacy response observation must never become an injected request.
			record["response_headers"] = map[string]any{"X-Codex-Turn-State": strings.Repeat("a", 312)}
		}
		raw, err := json.Marshal(record)
		if err != nil {
			t.Fatal(err)
		}
		lines = append(lines, string(raw))
	}
	if result := postUsageImport(t, handler, strings.Join(lines, "\n")+"\n"); result.Added != len(observations) {
		t.Fatalf("import count = %d", result.Added)
	}
	query := fmt.Sprintf(`{"from_ms":%d,"to_ms":%d,"include":{"events_page":{"limit":10}}}`, base.UnixMilli(), base.Add(time.Hour).UnixMilli())
	for _, key := range []string{"", "management-key"} {
		rr := testutil.Request(t, handler, http.MethodPost, "/v0/management/monitoring/analytics", query, key)
		testutil.RequireStatus(t, rr, http.StatusUnauthorized)
	}
	rr := testutil.Request(t, handler, http.MethodPost, "/v0/management/monitoring/analytics", query, testutil.AdminKey)
	testutil.RequireStatus(t, rr, http.StatusOK)
	var page struct {
		Events struct {
			Items []struct {
				AuthIndex string                        `json:"auth_index"`
				Metadata  *usage.ResponseHeaderMetadata `json:"response_metadata"`
			} `json:"items"`
		} `json:"events"`
	}
	testutil.DecodeJSON(t, rr, &page)
	if len(page.Events.Items) != len(observations) {
		t.Fatalf("monitoring returned %d events", len(page.Events.Items))
	}
	for i, item := range page.Events.Items {
		index := len(observations) - 1 - i
		want := observations[index]
		if item.AuthIndex != fmt.Sprintf("credential-%d", index) || item.Metadata == nil || item.Metadata.CodexTurnState == nil {
			t.Fatal("metadata or credential attribution lost")
		}
		state := item.Metadata.CodexTurnState
		if want.source == "" {
			if state.RequestLength != nil || state.RequestSource != "" || state.ResponseLength != 312 {
				t.Fatal("legacy response was mistaken for injected request")
			}
		} else if state.RequestLength == nil || *state.RequestLength != want.length || state.RequestSource != want.source || state.ResponseLength != 0 {
			t.Fatalf("request observation was not preserved: %+v", state)
		}
	}
	export := testutil.Request(t, handler, http.MethodGet, "/v0/management/usage/export", "", testutil.AdminKey)
	testutil.RequireStatus(t, export, http.StatusOK)
	if !strings.Contains(export.Body.String(), `"request_length":0,"request_source":"none"`) ||
		!strings.Contains(export.Body.String(), `"request_length":292,"request_source":"cache"`) {
		t.Fatal("export lost request metadata or explicit none")
	}
	if result := postUsageImport(t, handler, export.Body.String()); result.Added != 0 || result.Skipped != len(observations) {
		t.Fatal("export/import changed event identity")
	}
}
