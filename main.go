package main

import (
	"context"
	"embed"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/wirehouseworkers/listmonk-analytics/internal/api"
	"github.com/wirehouseworkers/listmonk-analytics/internal/config"
	"github.com/wirehouseworkers/listmonk-analytics/internal/db"
)

//go:embed web/static
var staticFiles embed.FS

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	database, err := db.New(ctx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer database.Close()

	log.Printf("capabilities: %+v", database.Caps)

	srv := api.New(cfg, database, staticFiles)

	httpSrv := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: srv.Handler(),
	}

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Println("shutting down...")
		shutCtx, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		httpSrv.Shutdown(shutCtx) //nolint:errcheck
	}()

	log.Printf("listening on %s", cfg.ListenAddr)
	if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("listen: %v", err)
	}
}
