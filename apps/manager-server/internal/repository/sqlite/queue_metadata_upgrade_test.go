package sqlite

import (
	"path/filepath"
	"testing"
	"time"
)

func TestQueueMetadataUpgradePreserves100kEventsAndResumesPartialSchema(t *testing.T) {
	path := filepath.Join(t.TempDir(), "queue-metadata-upgrade.sqlite")
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	const rowCount = 100_001
	if _, err := db.Exec(`with recursive ids(id) as (
		select 1 union all select id + 1 from ids where id < ?
	) insert into usage_events (
		id, event_hash, timestamp_ms, timestamp, model, created_at_ms
	) select id, 'queue-upgrade-' || id, id, cast(id as text), 'test-model', id from ids`, rowCount); err != nil {
		t.Fatal(err)
	}
	before := readUsageEventsSummary(t, db)
	columns := []string{"response_model", "session_id", "parent_session_id", "access_token_sha256", "generate", "stream"}
	for _, column := range columns {
		if _, err := db.Exec(`alter table usage_events drop column ` + column); err != nil {
			t.Fatal(err)
		}
	}
	// Simulate interruption after the first half of the bounded column additions.
	for _, column := range columns[:3] {
		if _, err := db.Exec(`alter table usage_events add column ` + column + ` text`); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	for restart := 0; restart < 2; restart++ {
		started := time.Now()
		db, err = Open(path)
		if err != nil {
			t.Fatal(err)
		}
		if elapsed := time.Since(started); elapsed > 10*time.Second {
			t.Fatalf("100k-event schema upgrade took %s", elapsed)
		}
		if after := readUsageEventsSummary(t, db); after != before {
			t.Fatalf("authoritative events changed: before=%+v after=%+v", before, after)
		}
		actual := migrationTableColumns(t, db, "usage_events")
		for _, column := range columns {
			if !actual[column] {
				t.Fatalf("missing %s after restart %d", column, restart)
			}
		}
		var populated int
		if err := db.QueryRow(`select count(*) from usage_events where
			response_model is not null or session_id is not null or parent_session_id is not null or
			access_token_sha256 is not null or generate is not null or stream is not null`).Scan(&populated); err != nil {
			t.Fatal(err)
		}
		if populated != 0 {
			t.Fatalf("legacy metadata was unexpectedly populated for %d rows", populated)
		}
		if err := db.Close(); err != nil {
			t.Fatal(err)
		}
	}
}
