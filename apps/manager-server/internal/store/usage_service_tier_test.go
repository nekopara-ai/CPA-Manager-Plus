package store

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/seakee/cpa-manager-plus/apps/manager-server/internal/service/pricing"
	"github.com/seakee/cpa-manager-plus/apps/manager-server/internal/usage"
)

func TestCodexFinalTierSurvivesStorageExportAndPricing(t *testing.T) {
	for _, tier := range []string{"auto", "default", "priority"} {
		t.Run(tier, func(t *testing.T) {
			db, err := Open(filepath.Join(t.TempDir(), "usage.sqlite"))
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = db.Close() })
			ctx := context.Background()
			// This is the CPA queue shape after payload filtering. Client intent,
			// final request metadata, and upstream response metadata are independent.
			raw := []byte(fmt.Sprintf(`{"request_id":"tier-%s","timestamp":"2026-09-14T00:00:00Z","provider":"codex","executor_type":"CodexExecutor","model":"gpt-5.6-sol","endpoint":"POST /v1/responses","service_tier":"priority","effective_service_tier":%q,"response_service_tier":"default","tokens":{"input_tokens":100000,"total_tokens":100000}}`, tier, tier))
			event, err := usage.NormalizeRaw(raw)
			if err != nil {
				t.Fatal(err)
			}
			if event.EffectiveServiceTier != tier {
				t.Fatalf("normalized effective tier = %q, want %q", event.EffectiveServiceTier, tier)
			}
			if _, err := db.InsertEvents(ctx, []usage.Event{event}); err != nil {
				t.Fatal(err)
			}
			events, err := db.RecentEvents(ctx, 10)
			if err != nil || len(events) != 1 {
				t.Fatalf("stored events = %d, error = %v", len(events), err)
			}
			stored := events[0]
			if stored.ServiceTier != tier || stored.RequestServiceTier != "priority" || stored.ResponseServiceTier != "default" {
				t.Fatalf("stored tiers = %q/%q/%q", stored.ServiceTier, stored.RequestServiceTier, stored.ResponseServiceTier)
			}
			payload := usage.BuildPayload(events)
			detail := payload.APIs["POST /v1/responses"].Models["gpt-5.6-sol"].Details[0]
			if detail.ServiceTier != tier || detail.RequestServiceTier != "priority" {
				t.Fatalf("compatible payload tiers = %q/%q", detail.ServiceTier, detail.RequestServiceTier)
			}
			exported, err := json.Marshal(stored)
			if err != nil {
				t.Fatal(err)
			}
			imported, err := usage.ParseImportPayload(exported)
			if err != nil || len(imported.Events) != 1 {
				t.Fatalf("reimport: %v", err)
			}
			restored := imported.Events[0]
			if restored.ServiceTier != tier || restored.EffectiveServiceTier != tier || restored.RequestServiceTier != "priority" {
				t.Fatalf("restored tiers = %q/%q/%q", restored.ServiceTier, restored.EffectiveServiceTier, restored.RequestServiceTier)
			}
			price := map[string]ModelPrice{"gpt-5.6-sol": {Prompt: 1, PromptConfigured: true,
				ServiceTiers: []ModelPriceServiceTier{{Mode: "fast", ServiceTier: "priority", Prompt: 3, PromptConfigured: true}},
			}}
			cost := pricing.CostForModelWithServiceTier(stored.Model, stored.ServiceTier, pricing.ModelTokens{InputTokens: stored.InputTokens}, price)
			want := 0.1
			if tier == "priority" {
				want = 0.3
			}
			if cost != want {
				t.Fatalf("cost = %v, want %v", cost, want)
			}
		})
	}
}
