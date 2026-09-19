package usagemonitoring_test

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/seakee/cpa-manager-plus/apps/manager-server/internal/store"
	"github.com/seakee/cpa-manager-plus/apps/manager-server/internal/usage"
)

func TestTicketLengthSurvivesIngestionAndMonitoringProjection(t *testing.T) {
	_, db := newMonitoringRepositoryStore(t)
	ctx := context.Background()
	base := time.Date(2026, 9, 19, 9, 0, 0, 0, time.UTC)
	for i, length := range []int{292, 312} {
		raw, err := json.Marshal(map[string]any{
			"timestamp": base.Add(time.Duration(i) * time.Second).Format(time.RFC3339),
			"provider":  "codex", "model": "gpt-5.6-sol", "auth_index": "auth-ticket",
			"endpoint": "POST /v1/responses", "failed": false,
			"tokens":           map[string]int{"input_tokens": 1, "total_tokens": 1},
			"response_headers": map[string]any{"X-Codex-Turn-State": []string{"gAAAAA" + strings.Repeat("a", length-6)}},
		})
		if err != nil {
			t.Fatal(err)
		}
		event, err := usage.NormalizeRaw(raw)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.InsertEvents(ctx, []usage.Event{event}); err != nil {
			t.Fatal(err)
		}
	}
	filter := store.AnalyticsFilter{FromMS: base.UnixMilli(), ToMS: base.Add(time.Hour).UnixMilli(), IncludeFailed: true}
	for _, projected := range []bool{false, true} {
		if projected {
			catchUpMonitoringRepository(t, ctx, db)
		}
		page, _, available, err := db.UsageMonitoringEventsPage(ctx, filter, 0, 0, 10)
		if err != nil || !available {
			t.Fatalf("monitoring page unavailable: projected=%v err=%v", projected, err)
		}
		if len(page.Items) != 2 {
			t.Fatalf("page count = %d", len(page.Items))
		}
		for i, item := range page.Items {
			want := []int{312, 292}[i]
			if item.AuthIndex != "auth-ticket" || item.ResponseMetadata == nil || item.ResponseMetadata.CodexTurnState == nil || item.ResponseMetadata.CodexTurnState.ResponseLength != want {
				t.Fatalf("ticket or credential missing on monitoring page: projected=%v item=%d", projected, i)
			}
		}
	}
}

func TestRequestTicketObservationSurvivesIngestionAndMonitoringProjection(t *testing.T) {
	_, db := newMonitoringRepositoryStore(t)
	ctx := context.Background()
	base := time.Date(2026, 9, 19, 12, 0, 0, 0, time.UTC)
	observations := []struct {
		source string
		length int
	}{{"cache", 292}, {"passthrough", 312}, {"none", 0}, {"", -1}}
	for i, observation := range observations {
		record := map[string]any{
			"timestamp": base.Add(time.Duration(i) * time.Second).Format(time.RFC3339),
			"provider":  "codex", "model": "fixture-model", "auth_index": fmt.Sprintf("auth-%d", i),
			"failed": i == 1, "tokens": map[string]int{"input_tokens": 1, "total_tokens": 1},
		}
		if observation.source != "" {
			record["codex_turn_state"] = map[string]any{"request_length": observation.length, "request_source": observation.source}
		}
		raw, err := json.Marshal(record)
		if err != nil {
			t.Fatal(err)
		}
		event, err := usage.NormalizeRaw(raw)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.InsertEvents(ctx, []usage.Event{event}); err != nil {
			t.Fatal(err)
		}
	}
	filter := store.AnalyticsFilter{FromMS: base.UnixMilli(), ToMS: base.Add(time.Hour).UnixMilli(), IncludeFailed: true}
	for _, projected := range []bool{false, true} {
		if projected {
			catchUpMonitoringRepository(t, ctx, db)
		}
		page, _, available, err := db.UsageMonitoringEventsPage(ctx, filter, 0, 0, 10)
		if err != nil || !available || len(page.Items) != len(observations) {
			t.Fatalf("page unavailable or incomplete: projected=%v err=%v", projected, err)
		}
		for i, item := range page.Items {
			index := len(observations) - 1 - i
			want := observations[index]
			if item.AuthIndex != fmt.Sprintf("auth-%d", index) {
				t.Fatal("request ticket attached to wrong credential")
			}
			if want.source == "" {
				if item.ResponseMetadata != nil && item.ResponseMetadata.CodexTurnState != nil {
					t.Fatal("old event acquired a fabricated ticket")
				}
				continue
			}
			if item.ResponseMetadata == nil || item.ResponseMetadata.CodexTurnState == nil {
				t.Fatal("request metadata lost without response ticket headers")
			}
			state := item.ResponseMetadata.CodexTurnState
			if state.RequestLength == nil || *state.RequestLength != want.length || state.RequestSource != want.source || state.ResponseLength != 0 {
				t.Fatalf("request observation changed: %+v", state)
			}
		}
	}
}
