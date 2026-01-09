# Development Guide

This guide contains notes and workflows for developers working on the Electricity App.

## 🐳 Docker Workflow

The project is fully containerized. However, there are important differences in how the services handle code changes during development.

### Frontend (`frontend/`)

**⚠️ CRITICAL: The frontend container uses a production-style build.**

*   **Technology**: Multi-stage Dockerfile (Node build -> Nginx serve).
*   **Behavior**: The source code is **compiled** into static files at build time.
*   **Implication**: **Volume mounting does NOT work for code changes.**
*   **Workflow**:
    *   If you make changes to files in `frontend/src/`:
    *   **YOU MUST REBUILD THE CONTAINER:**
        ```bash
        docker compose build frontend
        docker compose up -d frontend
        ```
    *   Simply restarting the container (`docker compose restart frontend`) will **NOT** reflect your code changes.

### Backend (`backend/`)

*   **Technology**: Node.js with Nodemon (via `npm start`).
*   **Behavior**: Code is volume-mounted into the container at runtime.
*   **Workflow**:
    *   Changes to `backend/` files are detected automatically if `nodemon` is running, or require a simple restart:
        ```bash
        docker compose restart backend
        ```

## 🛠️ Common Tasks

### Admin Dashboard Debugging

The `/admin` route is a protected frontend route.
-   **Verification**: If the page is blank, it often means the `nginx` container is serving an old build. **Rebuild the frontend container.**
-   **Caching**: Browsers aggressively cache the specific JS bundles. If a rebuild doesn't work, try appending a query string: `http://localhost:3000/admin?v=2`

### Database Access

To access the PostgreSQL database directly:
```bash
docker compose exec database psql -U electricity_user -d electricity_app
```

### Useful Commands

| Action | Command |
| :--- | :--- |
| **Apply Frontend Changes** | `docker compose build frontend && docker compose up -d frontend` |
| **Restart Backend** | `docker compose restart backend` |
| **View Logs** | `docker compose logs -f` |
| **View Frontend Logs** | `docker compose logs -f frontend` |
