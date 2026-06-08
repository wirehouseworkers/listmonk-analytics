package config_test

import (
	"testing"

	"github.com/wirehouseworkers/listmonk-analytics/internal/config"
)

func TestLoad(t *testing.T) {
	t.Run("all fields set", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "postgres://u:p@host/db")
		t.Setenv("LISTEN_ADDR", ":9090")
		t.Setenv("DASHBOARD_USER", "admin")
		t.Setenv("DASHBOARD_PASS", "secret")
		t.Setenv("ROOT_URL", "https://example.com")
		t.Setenv("ENGAGED_WINDOW_DAYS", "30")

		cfg, err := config.Load()
		if err != nil {
			t.Fatalf("Load() error = %v", err)
		}
		if cfg.DatabaseURL != "postgres://u:p@host/db" {
			t.Errorf("DatabaseURL = %q", cfg.DatabaseURL)
		}
		if cfg.ListenAddr != ":9090" {
			t.Errorf("ListenAddr = %q, want :9090", cfg.ListenAddr)
		}
		if cfg.DashboardUser != "admin" {
			t.Errorf("DashboardUser = %q", cfg.DashboardUser)
		}
		if cfg.DashboardPass != "secret" {
			t.Errorf("DashboardPass = %q", cfg.DashboardPass)
		}
		if cfg.RootURL != "https://example.com" {
			t.Errorf("RootURL = %q", cfg.RootURL)
		}
		if cfg.EngagedWindowDays != 30 {
			t.Errorf("EngagedWindowDays = %d, want 30", cfg.EngagedWindowDays)
		}
	})

	t.Run("optional defaults", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "postgres://u:p@host/db")
		t.Setenv("LISTEN_ADDR", "")
		t.Setenv("PORT", "")
		t.Setenv("ENGAGED_WINDOW_DAYS", "")

		cfg, err := config.Load()
		if err != nil {
			t.Fatalf("Load() error = %v", err)
		}
		if cfg.ListenAddr != ":8080" {
			t.Errorf("ListenAddr = %q, want :8080", cfg.ListenAddr)
		}
		if cfg.EngagedWindowDays != 90 {
			t.Errorf("EngagedWindowDays = %d, want 90", cfg.EngagedWindowDays)
		}
	})

	t.Run("PORT fallback", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "postgres://u:p@host/db")
		t.Setenv("LISTEN_ADDR", "")
		t.Setenv("PORT", "3000")

		cfg, err := config.Load()
		if err != nil {
			t.Fatalf("Load() error = %v", err)
		}
		if cfg.ListenAddr != ":3000" {
			t.Errorf("ListenAddr = %q, want :3000", cfg.ListenAddr)
		}
	})

	t.Run("missing DATABASE_URL", func(t *testing.T) {
		t.Setenv("DATABASE_URL", "")

		_, err := config.Load()
		if err == nil {
			t.Fatal("Load() expected error for missing DATABASE_URL, got nil")
		}
	})
}
