# ---- Stage 1: build ----
# Build the Go binary inside a full Go toolchain image. The //go:embed
# web/static directive bakes the entire frontend into the binary at
# compile time, so the final image only needs the binary itself.
FROM golang:1.22-alpine AS builder

WORKDIR /build

# Fetch module dependencies as a separate cache layer so that source
# changes don't re-download modules on every build.
COPY go.mod go.sum ./
RUN go mod download

# Copy the full source tree (web/static is embedded at compile time).
COPY . .

# Produce a fully static binary: CGO disabled, no shared libraries.
# -s -w strips the symbol table and DWARF info to shrink the binary.
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /listmonk-analytics \
    .

# ---- Stage 2: minimal runtime ----
# distroless/static contains nothing except ca-certificates and tzdata —
# no shell, no package manager, no C runtime. A CGO_ENABLED=0 Go binary
# runs here with near-zero attack surface.
# :nonroot runs as uid 65532 (not root) by default.
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /listmonk-analytics /listmonk-analytics

# Railway sets PORT automatically at runtime. The config layer reads PORT
# first, then LISTEN_ADDR, then defaults to :8080. EXPOSE is documentation.
EXPOSE 8080

ENTRYPOINT ["/listmonk-analytics"]
