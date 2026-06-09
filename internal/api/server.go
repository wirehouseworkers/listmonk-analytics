package api

import (
	"encoding/json"
	"io/fs"
	"net/http"

	"github.com/wirehouseworkers/listmonk-analytics/internal/config"
	"github.com/wirehouseworkers/listmonk-analytics/internal/db"
)

// Server is the HTTP server for listmonk-analytics.
type Server struct {
	cfg    *config.Config
	db     *db.DB
	static fs.FS
	mux    *http.ServeMux
}

// New constructs a Server and registers all routes. static must be a
// sub-FS rooted at the directory containing index.html.
func New(cfg *config.Config, d *db.DB, static fs.FS) *Server {
	s := &Server{cfg: cfg, db: d, static: static}
	s.mux = http.NewServeMux()
	s.routes()
	return s
}

// Handler returns the root HTTP handler for use with http.Server.
func (s *Server) Handler() http.Handler {
	return s.mux
}

// withAuth wraps h in basic-auth when credentials are configured. Handlers
// added in later sections call this so auth behaviour stays consistent.
func (s *Server) withAuth(h http.Handler) http.Handler {
	if s.cfg.DashboardUser != "" && s.cfg.DashboardPass != "" {
		return basicAuth(s.cfg.DashboardUser, s.cfg.DashboardPass, h)
	}
	return h
}

func (s *Server) routes() {
	// Health is never behind auth (load balancers and Railway need it).
	s.mux.HandleFunc("GET /health", s.handleHealth)

	// Metric endpoints — auth-gated when credentials are configured.
	s.mux.Handle("GET /api/campaigns", s.withAuth(http.HandlerFunc(s.handleCampaigns)))
	s.mux.Handle("GET /api/campaigns/{id}/opens", s.withAuth(http.HandlerFunc(s.handleCampaignOpens)))
	s.mux.Handle("GET /api/campaigns/{id}/clicks", s.withAuth(http.HandlerFunc(s.handleCampaignClicks)))
	s.mux.Handle("GET /api/campaigns/{id}/links", s.withAuth(http.HandlerFunc(s.handleCampaignLinks)))
	s.mux.Handle("GET /api/campaigns/{id}/curve", s.withAuth(http.HandlerFunc(s.handleCampaignCurve)))
	s.mux.Handle("GET /api/campaigns/{id}/bounces", s.withAuth(http.HandlerFunc(s.handleCampaignBounces)))
	s.mux.Handle("GET /api/bounces/trend", s.withAuth(http.HandlerFunc(s.handleBounceTrend)))

	// Static shell — auth-gated when credentials are configured.
	sub, _ := fs.Sub(s.static, "web/static")
	s.mux.Handle("/", s.withAuth(http.FileServer(http.FS(sub))))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
