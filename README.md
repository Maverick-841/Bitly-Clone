# Distributed URL Shortener (Short.ly)

A production-ready, full-stack scalable URL shortening platform built to handle high traffic, provide real-time analytics, and offer a premium user experience.

## ✨ Features

- **Scalable Architecture**: Next.js frontend, Node.js/Express API, PostgreSQL database, and Redis caching.
- **High-Performance Click Tracking**: Leveraging Redis `INCR` for atomic, sub-millisecond click limit verification, bypassing database bottlenecks.
- **Lightning Fast Redirects**: High-performance URL resolution using Redis before hitting the database.
- **Health Monitoring**: Integrated `/health` endpoint for infrastructure monitoring and uptime tracking.
- **Real-Time Analytics Dashboard**: Track total clicks, timelines, browsers, devices, and geographic locations.

## 🛠️ Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Chart.js, qrcode.react, Lucide React
- **Backend**: Node.js, Express.js, bcrypt, jsonwebtoken, useragent
- **Database**: PostgreSQL
- **Caching**: Redis
- **Reverse Proxy**: NGINX
- **Containerization**: Docker & Docker Compose

## 🚀 Quick Start (Docker)

The easiest way to run the entire application stack is using Docker Compose.

1. **Clone the repository** (if applicable) and navigate to the project root:
   ```bash
   cd url-shortener
   ```

2. **Start the infrastructure**:
   ```bash
   cd docker
   docker-compose up -d --build
   ```

3. **Access the application**:
   - Web App: http://localhost
   - API Services: http://localhost/api
   - Health Check: http://localhost/api/health

## 📂 Project Structure

```
url-shortener/
├── backend/               # Node.js/Express API
│   ├── src/
│   │   ├── config/        # DB & Redis connection setups
│   │   ├── controllers/   # Auth & URL business logic
│   │   ├── middleware/    # JWT & Rate limiting
│   │   ├── routes/        # API route definitions
│   │   └── services/      # Redirect logic
│   ├── Dockerfile
│   └── package.json
├── frontend/              # Next.js Application
│   ├── src/
│   │   ├── app/           # App Router pages (/, /login, /dashboard)
│   │   ├── lib/           # Axios API client setup
│   ├── Dockerfile
│   ├── tailwind.config.js
│   └── package.json
├── database/              # PostgreSQL Schema
│   └── schema.sql
├── docker/                # Docker Orchestration
│   └── docker-compose.yml
└── nginx/                 # NGINX Configuration
    └── nginx.conf
```

## 🔐 Environment Variables

If running locally without Docker, ensure you have the following `.env` configurations set in the backend:

```env
PORT=5000
DB_USER=admin
DB_PASSWORD=password123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=url_shortener
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecret_jwt_key_here
CLIENT_URL=http://localhost:3000
```

Frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

*(Note: These are automatically handled via Docker Compose in this setup).*

## 📊 Analytics Tracking

The `/redirect` service parses incoming traffic and extracts metadata:
- Browser and Device via `useragent`
- Click timestamps
These metrics feed directly into the `Chart.js` components on the Next.js frontend for an instant visual breakdown.

---
*Built as a professional GitHub portfolio project.*
