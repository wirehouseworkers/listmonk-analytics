package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	DatabaseURL       string
	ListenAddr        string
	DashboardUser     string
	DashboardPass     string
	RootURL           string
	EngagedWindowDays int
}

func Load() (*Config, error) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}

	cfg := &Config{
		DatabaseURL:       dbURL,
		DashboardUser:     os.Getenv("DASHBOARD_USER"),
		DashboardPass:     os.Getenv("DASHBOARD_PASS"),
		RootURL:           os.Getenv("ROOT_URL"),
		EngagedWindowDays: 90,
	}

	switch {
	case os.Getenv("LISTEN_ADDR") != "":
		cfg.ListenAddr = os.Getenv("LISTEN_ADDR")
	case os.Getenv("PORT") != "":
		cfg.ListenAddr = ":" + os.Getenv("PORT")
	default:
		cfg.ListenAddr = ":8080"
	}

	if raw := os.Getenv("ENGAGED_WINDOW_DAYS"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 {
			return nil, fmt.Errorf("ENGAGED_WINDOW_DAYS must be a positive integer, got %q", raw)
		}
		cfg.EngagedWindowDays = n
	}

	return cfg, nil
}
