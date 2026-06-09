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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
