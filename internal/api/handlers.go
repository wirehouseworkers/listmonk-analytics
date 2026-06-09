package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/wirehouseworkers/listmonk-analytics/internal/db"
)

// handleCampaigns serves the campaign comparison table.
//
// Query params:
//   - include_optin=true  include type='optin' campaigns (default: excluded)
//   - status=<status>     filter by campaign status (default: all)
//   - sort=<field>        id|name|sent|sent_date|open_rate|click_rate|
//     bounce_rate|complaint_rate (default: sent_date)
//   - order=asc|desc      (default: desc)
func (s *Server) handleCampaigns(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	opts := db.CampaignComparisonOptions{
		IncludeOptin: q.Get("include_optin") == "true",
		Status:       q.Get("status"),
		SortBy:       q.Get("sort"),
		Order:        q.Get("order"),
	}

	rows, err := s.db.CampaignComparison(r.Context(), opts)
	if err != nil {
		if errors.Is(err, db.ErrInvalidOption) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if rows == nil {
		rows = []db.CampaignRow{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"campaigns": rows})
}

// handleCampaignOpens serves metric #1 (open rate + diagnostics) for one
// campaign. Path: /api/campaigns/{id}/opens. Query param include_optin=true
// allows requesting an optin campaign (excluded by default).
func (s *Server) handleCampaignOpens(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}
	includeOptin := r.URL.Query().Get("include_optin") == "true"

	m, err := s.db.CampaignOpenMetrics(r.Context(), id, includeOptin)
	if err != nil {
		if errors.Is(err, db.ErrCampaignNotFound) {
			http.Error(w, "campaign not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, m)
}

// handleCampaignClicks serves metric #2 (click rate + CTOR) for one campaign.
// Path: /api/campaigns/{id}/clicks. Query param include_optin=true allows
// requesting an optin campaign (excluded by default).
func (s *Server) handleCampaignClicks(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}
	includeOptin := r.URL.Query().Get("include_optin") == "true"

	m, err := s.db.CampaignClickMetrics(r.Context(), id, includeOptin)
	if err != nil {
		if errors.Is(err, db.ErrCampaignNotFound) {
			http.Error(w, "campaign not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, m)
}

// handleCampaignLinks serves metric #3 (per-link click breakdown) for one
// campaign. Path: /api/campaigns/{id}/links. Query param include_optin=true
// allows requesting an optin campaign (excluded by default).
func (s *Server) handleCampaignLinks(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}
	includeOptin := r.URL.Query().Get("include_optin") == "true"

	m, err := s.db.CampaignLinkBreakdown(r.Context(), id, includeOptin)
	if err != nil {
		if errors.Is(err, db.ErrCampaignNotFound) {
			http.Error(w, "campaign not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, m)
}

// handleCampaignCurve serves metric #4 (engagement curve) for one campaign.
// Path: /api/campaigns/{id}/curve. Query param include_optin=true allows
// requesting an optin campaign (excluded by default).
func (s *Server) handleCampaignCurve(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}
	includeOptin := r.URL.Query().Get("include_optin") == "true"

	m, err := s.db.CampaignEngagementCurve(r.Context(), id, includeOptin)
	if err != nil {
		if errors.Is(err, db.ErrCampaignNotFound) {
			http.Error(w, "campaign not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, m)
}

// handleCampaignBounces serves metric #5 per-campaign (soft/hard bounce counts
// and bounce rate, plus complaints and complaint rate kept separate) for one
// campaign. Path: /api/campaigns/{id}/bounces. Query param include_optin=true
// allows requesting an optin campaign (excluded by default).
func (s *Server) handleCampaignBounces(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}
	includeOptin := r.URL.Query().Get("include_optin") == "true"

	m, err := s.db.CampaignBounceMetrics(r.Context(), id, includeOptin)
	if err != nil {
		if errors.Is(err, db.ErrCampaignNotFound) {
			http.Error(w, "campaign not found", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, m)
}

// handleBounceTrend serves metric #5 global trend: daily soft/hard/complaint
// counts across all campaigns (including campaign-untied bounces).
// Path: /api/bounces/trend.
func (s *Server) handleBounceTrend(w http.ResponseWriter, r *http.Request) {
	t, err := s.db.BounceTrend(r.Context())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, t)
}

// handleSubscriberGrowth serves metric #7 growth: new subscribers per time
// bucket. Path: /api/subscribers/growth. Query param interval=day|week
// (default day).
func (s *Server) handleSubscriberGrowth(w http.ResponseWriter, r *http.Request) {
	g, err := s.db.SubscriberGrowth(r.Context(), r.URL.Query().Get("interval"))
	if err != nil {
		if errors.Is(err, db.ErrInvalidOption) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, g)
}

// handleListActiveCounts serves metric #7 per-list active counts, applying each
// list's opt-in rule. Path: /api/lists.
func (s *Server) handleListActiveCounts(w http.ResponseWriter, r *http.Request) {
	c, err := s.db.ListActiveCounts(r.Context())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, c)
}

// handleSubscriberEngagement serves metric #8: the subscriber engagement
// leaderboard. Path: /api/subscribers/engagement. Query params: window (days,
// default config ENGAGED_WINDOW_DAYS), limit, offset.
//
// HARD GATE (auth/PII): this exposes subscriber email/name. It refuses to serve
// when no dashboard credentials are configured, because serving PII on an
// unauthenticated endpoint is unsafe. When credentials ARE set, withAuth has
// already enforced basic auth before this handler runs. (The IndividualTracking
// hard gate is enforced in the db layer.)
func (s *Server) handleSubscriberEngagement(w http.ResponseWriter, r *http.Request) {
	if s.cfg.DashboardUser == "" || s.cfg.DashboardPass == "" {
		writeJSON(w, http.StatusForbidden, map[string]any{
			"individual_tracking": s.db.Caps.IndividualTracking,
			"subscribers":         []any{},
			"note": "subscriber engagement requires authentication to be enabled " +
				"(set DASHBOARD_USER and DASHBOARD_PASS); refusing to serve subscriber PII on an unauthenticated endpoint",
		})
		return
	}

	q := r.URL.Query()
	window := s.cfg.EngagedWindowDays
	if raw := q.Get("window"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 {
			http.Error(w, "invalid window", http.StatusBadRequest)
			return
		}
		window = n
	}
	limit, err := atoiDefault(q.Get("limit"), 0)
	if err != nil {
		http.Error(w, "invalid limit", http.StatusBadRequest)
		return
	}
	offset, err := atoiDefault(q.Get("offset"), 0)
	if err != nil {
		http.Error(w, "invalid offset", http.StatusBadRequest)
		return
	}

	res, err := s.db.SubscriberEngagement(r.Context(), window, limit, offset)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, res)
}

// atoiDefault parses s, returning def when s is empty. A non-empty, non-integer
// value is an error.
func atoiDefault(s string, def int) (int, error) {
	if s == "" {
		return def, nil
	}
	return strconv.Atoi(s)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
