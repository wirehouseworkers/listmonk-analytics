package api

import (
	"encoding/json"
	"errors"
	"net/http"

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

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
