package api_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"testing/fstest"
	"time"

	"github.com/wirehouseworkers/listmonk-analytics/internal/api"
	"github.com/wirehouseworkers/listmonk-analytics/internal/config"
	"github.com/wirehouseworkers/listmonk-analytics/internal/db"
)

// TestEngagementHardGates verifies the two hard gates on the subscriber
// engagement endpoint:
//  1. Auth/PII gate — with no DASHBOARD_USER/PASS configured the endpoint
//     refuses (403) and returns no subscriber data.
//  2. When credentials ARE configured, withAuth enforces basic auth (401
//     without a valid header) and the handler serves only to authenticated
//     callers.
func TestEngagementHardGates(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set; skipping live read-only DB test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	d, err := db.New(ctx, url)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	defer d.Close()

	static := fstest.MapFS{}
	const path = "/api/subscribers/engagement"

	// --- Gate 1: no credentials configured → refuse with 403, no PII. ---
	noAuth := api.New(&config.Config{EngagedWindowDays: 90}, d, static)
	rec := httptest.NewRecorder()
	noAuth.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))

	if rec.Code != http.StatusForbidden {
		t.Errorf("no-auth: status=%d want %d", rec.Code, http.StatusForbidden)
	}
	var body struct {
		Note        string `json:"note"`
		Subscribers []any  `json:"subscribers"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("no-auth: decode body: %v", err)
	}
	if len(body.Subscribers) != 0 {
		t.Errorf("no-auth: returned %d subscribers; PII must not be served", len(body.Subscribers))
	}
	if body.Note == "" {
		t.Errorf("no-auth: expected an explanatory note")
	}
	t.Logf("GATE 1 (auth required): status=%d note=%q subscribers=%d", rec.Code, body.Note, len(body.Subscribers))

	// --- Gate 2: credentials configured → basic auth enforced. ---
	withCreds := api.New(&config.Config{EngagedWindowDays: 90, DashboardUser: "u", DashboardPass: "p"}, d, static)

	// (a) No Authorization header → 401.
	rec = httptest.NewRecorder()
	withCreds.Handler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("auth-on/no-header: status=%d want %d", rec.Code, http.StatusUnauthorized)
	}
	t.Logf("GATE 2a (no header): status=%d", rec.Code)

	// (b) Correct credentials → 200 and a well-formed payload.
	rec = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, path+"?limit=3", nil)
	req.SetBasicAuth("u", "p")
	withCreds.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("auth-on/valid: status=%d want 200 (body=%s)", rec.Code, rec.Body.String())
	}
	var ok struct {
		IndividualTracking bool `json:"individual_tracking"`
		WindowDays         int  `json:"window_days"`
		Subscribers        []struct {
			SubscriberID int `json:"subscriber_id"`
		} `json:"subscribers"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &ok); err != nil {
		t.Fatalf("auth-on/valid: decode body: %v", err)
	}
	t.Logf("GATE 2b (valid creds): status=%d tracking=%t window=%d subscribers_returned=%d",
		rec.Code, ok.IndividualTracking, ok.WindowDays, len(ok.Subscribers))
}
