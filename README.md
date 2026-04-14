# Bitly Clone (Distributed URL Shortener)

A scalable URL shortening platform with Redis-backed redirects, JWT authentication, click analytics, and Docker-based deployment.

This repository currently contains the backend API, database schema, Docker stack, and NGINX proxy configuration. The `frontend` directory exists but is empty in this clone.

## Overview

The service is designed for fast redirects and production-style architecture:

- Node.js + Express API for auth, URL management, and analytics.
- PostgreSQL for durable storage of users, URLs, and click events.
- Redis for hot-path URL lookups and high-speed click counting.
- NGINX reverse proxy for routing frontend, API, and short-link traffic.
- Docker Compose to run all services together.

## Core Features

- User registration and login with JWT-based authentication.
- Short URL creation with optional custom alias.
- Optional expiration date for links.
- Optional click limit with Redis `INCR` enforcement.
- Optional password protection for links.
- Per-link analytics (timeline, browser, device, country).
- CSV analytics export.
- URL deletion with Redis cache cleanup.
- Health endpoint for uptime monitoring.

## Tech Stack

- Backend: Node.js, Express, jsonwebtoken, bcryptjs, ioredis, pg, express-rate-limit
- Data: PostgreSQL
- Cache: Redis
- Proxy: NGINX
- Orchestration: Docker Compose

## Repository Structure

```text
Bitly-Clone/
|-- backend/
|   |-- src/
|   |   |-- config/        # PostgreSQL and Redis clients
|   |   |-- controllers/   # Auth and URL business logic
|   |   |-- middleware/    # JWT auth middleware
|   |   |-- routes/        # API route definitions
|   |   |-- services/      # Redirect resolver logic
|   |   `-- server.js
|   |-- Dockerfile
|   |-- package.json
|   `-- package-lock.json
|-- database/
|   `-- schema.sql          # users, urls, clicks tables + indexes
|-- docker/
|   `-- docker-compose.yml  # db, redis, backend, frontend, nginx services
|-- frontend/               # Present but empty in current repository state
|-- nginx/
|   `-- nginx.conf
|-- .gitignore
`-- README.md
```

## API Endpoints

Base path: `/api`

Auth:

- `POST /api/auth/register`
- `POST /api/auth/login`

URL management (requires `Authorization: Bearer <token>` unless noted):

- `POST /api/urls/shorten`
- `GET /api/urls/`
- `GET /api/urls/stats/overview`
- `GET /api/urls/:id/analytics`
- `GET /api/urls/:id/export`
- `POST /api/urls/:id/verify-password` (no auth required)
- `DELETE /api/urls/:id`

Redirect and health:

- `GET /health`
- `GET /:shortCode`

## Environment Variables

Backend supports these variables:

- `PORT` (default: `5000`)
- `DB_USER` (default: `admin`)
- `DB_PASSWORD` (default: `password123`)
- `DB_HOST` (default: `localhost`)
- `DB_PORT` (default: `5432`)
- `DB_NAME` (default: `url_shortener`)
- `REDIS_URL` (default: `redis://localhost:6379`)
- `JWT_SECRET` (required in production)
- `CLIENT_URL` (used by CORS, default: `http://localhost`)
- `FRONTEND_URL` (used for password-protected redirect flow, default: `http://localhost:3000`)

## Quick Start with Docker

Prerequisites:

- Docker
- Docker Compose

From the project root:

```bash
cd docker
docker compose up -d --build
```

Service URLs:

- NGINX entry: http://localhost
- API through NGINX: http://localhost/api
- Health check: http://localhost/api/health
- Backend direct: http://localhost:5000

Stop stack:

```bash
docker compose down
```

Stop stack and remove volumes:

```bash
docker compose down -v
```

## Quick API Smoke Test

After starting services, verify the API is reachable:

```bash
curl http://localhost/api/health
```

Expected response should include a healthy status from the backend.

## Local Backend Setup (Without Docker)

Prerequisites:

- Node.js 18+
- PostgreSQL
- Redis

1. Install dependencies:

```bash
cd backend
npm install
```

2. Create database and load schema:

```bash
# from project root
psql -U admin -d url_shortener -f database/schema.sql
```

3. Configure environment variables for backend.

4. Start the backend:

```bash
node src/server.js
```

## Database Design Summary

- `users`: account credentials and created timestamp.
- `urls`: shortened link metadata, optional alias, optional expiration, optional click limit, optional password hash.
- `clicks`: per-visit analytics data (timestamp, country, device, browser).

Indexes are included for short-code lookups, user URL listing, and click analytics performance.

## How Redirects Work

1. Resolve short code from Redis cache first.
2. Fallback to PostgreSQL when cache miss occurs, then warm cache.
3. Enforce expiration and click-limit rules.
4. Log click analytics asynchronously.
5. Redirect to original URL, or to password page if link is protected.

## Known Repository Notes

- The backend `package.json` currently has no `start` or `dev` script, so run with `node src/server.js`.
- `uuid` is imported in URL controller but not used in current logic.
- Docker Compose references a frontend image build, but the `frontend` directory is empty in this clone.

## Production Hardening Checklist

- Set a strong `JWT_SECRET`.
- Move database and Redis credentials to secure secrets management.
- Restrict CORS `CLIENT_URL` to your actual frontend origin.
- Add structured logging and centralized monitoring.
- Add HTTPS and secure headers in NGINX.
- Add automated tests for auth, redirects, and analytics.

## License

No explicit license file is currently present in this repository.
