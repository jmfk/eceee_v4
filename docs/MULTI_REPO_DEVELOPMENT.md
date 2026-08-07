# Multi-Repository & Branch Development

This guide explains how to set up a secondary repository instance (e.g., for working on a specific branch or a separate project) that connects to a shared infrastructure (PostgreSQL, Redis, MinIO, imgproxy).

## 🏗️ Shared Infrastructure Architecture

Instead of each repository instance running its own set of database and infrastructure containers, we use a **Shared Infrastructure** model.

1.  **Main Repository**: Runs the "Source of Truth" infrastructure services.
2.  **Secondary Repository**: Runs only the application services (Backend, Frontend) and connects to the shared infrastructure via a shared Docker network.

## 🚀 Setup Instructions

### 1. Prepare the Main Repository
In your main repository instance, ensure the shared infrastructure is running. The main repository should have a `docker-compose.infra.yml` or similar that exposes services on the `eceee_shared_network`.

```bash
# In the main repo
make servers  # Starts db, redis, minio, imgproxy
```

### 2. Prepare this Repository
In this repository instance, you need to configure your `.env` to point to the shared infrastructure and join the shared network.

#### Automatic Setup
Run the following command to automatically initialize your `.env` and configure the hostnames:

```bash
make use-external-infra
```

This will:
- Create a `.env` file if it doesn't exist.
- Update `POSTGRES_HOST`, `REDIS_URL`, etc., to use the shared container names (`eceee_v4_db`, `eceee_v4_redis`, etc.).
- Verify connectivity to the shared services.

#### Manual Verification
You can check if your repository is correctly configured and connected to the shared infrastructure using:

```bash
make check-conf
```

## 🔄 Branch-Based Database Replication

When working on a specific branch, you often want a copy of the main database to avoid polluting the shared data.

### Replicate Database
Run the following command to clone the current database into a new one named after your current git branch:

```bash
make replicate-db
```

**What it does:**
1.  Detects your current git branch (e.g., `feature/my-task`).
2.  Creates a new database on the shared Postgres server named `feature_my_task` using the current DB as a template.
3.  Updates your `.env` file (`POSTGRES_DB` and `DATABASE_URL`) to use this new database.

### Apply Changes
After replicating the database, you must restart your local backend to pick up the new configuration:

```bash
make restart
```

## 🔍 Health Checks

Use these commands to verify your environment status:

-   `make check-servers`: Comprehensive health check of both local apps and external infrastructure.
-   `make check-conf`: Detailed report on `.env` settings, network connectivity, and the actual database the backend is using.

## 🛠️ Summary of Commands

| Command | Description |
|---------|-------------|
| `make use-external-infra` | Initialize/Update `.env` for shared infra |
| `make check-conf` | Check DB and network configuration |
| `make check-servers` | Verify status of all local and external services |
| `make replicate-db` | Clone DB to a branch-specific version |
| `make backend` | Start only the local backend |
| `make frontend` | Start only the local frontend |

