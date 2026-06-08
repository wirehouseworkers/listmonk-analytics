package main

import (
	"fmt"
	"os"
)

func main() {
	if os.Getenv("DATABASE_URL") == "" {
		fmt.Fprintln(os.Stderr, "listmonk-analytics: DATABASE_URL is required")
		os.Exit(1)
	}
	fmt.Println("listmonk-analytics: config OK (stub — exiting)")
}
