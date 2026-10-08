# ============================================================
# Production Deployment (runs on remote VPS via SSH)
# Override PROD_HOST only when the canonical production SSH endpoint changes.
# ============================================================
PROD_HOST ?= root@139.162.154.219
PROD_DIR  ?= /srv/eceee_v4
TAG       ?=
RUN_ID    ?= typed-tags-v1
CANARY_SIZE ?= 100
BACKUP_FILE ?=
KEEP_BACKUP ?= 0
LOCAL_BACKUP_DIR ?=
THEME_WORKSPACE ?=
THEME_ADMIN ?=
export RUN_ID CANARY_SIZE THEME_WORKSPACE THEME_ADMIN

prod-preflight: ## Run checks required before production deploy (use: make prod-preflight [TAG=v0.x.x|hash])
	bash deploy/scripts/preflight.sh "$(TAG)"

prod-deploy: ## Run checks, then deploy to production (use: make prod-deploy [TAG=v0.x.x|hash])
	@set -e; \
	DEPLOY_REF=$$(bash deploy/scripts/resolve-deploy-ref.sh "$(TAG)"); \
	echo "Resolved deploy ref: $$DEPLOY_REF"; \
	bash deploy/scripts/preflight.sh "$$DEPLOY_REF"; \
	bash deploy/scripts/setup-env.sh "$(PROD_HOST)" "$(PROD_DIR)" --deploy "$$DEPLOY_REF"

prod-restart: ## Sync deploy/.env and restart production containers
	bash deploy/scripts/setup-env.sh "$(PROD_HOST)" "$(PROD_DIR)" --restart

prod-env: ## Securely push local deploy/.env to production
	bash deploy/scripts/setup-env.sh $(PROD_HOST) $(PROD_DIR)

prod-rollback: ## Rollback to previous deployment
	ssh $(PROD_HOST) "cd $(PROD_DIR) && bash deploy/scripts/rollback.sh"

prod-backup: ## Run ad-hoc production DB backup
	ssh $(PROD_HOST) "cd $(PROD_DIR) && bash deploy/scripts/backup.sh"

prod-theme-access-key: ## Create/rotate prod theme key (THEME_WORKSPACE=id THEME_ADMIN=username)
	bash deploy/scripts/create-theme-remote-access.sh "$(PROD_HOST)" "$(PROD_DIR)"

prod-backfill-typed-tags: ## Run maintenance-window typed-tag backfill (optional: RUN_ID=... CANARY_SIZE=...)
	@case "$$RUN_ID" in ""|*[!A-Za-z0-9_-]*) echo "RUN_ID must contain only letters, numbers, underscores, and hyphens" >&2; exit 2;; esac
	@[ "$${#RUN_ID}" -le 100 ] || (echo "RUN_ID must be at most 100 characters" >&2; exit 2)
	@case "$$CANARY_SIZE" in ""|0*|*[!0-9]*) echo "CANARY_SIZE must be a positive integer without leading zeros" >&2; exit 2;; esac
	ssh $(PROD_HOST) "cd $(PROD_DIR) && bash deploy/scripts/backfill-typed-tags.sh '$$RUN_ID' '$$CANARY_SIZE'"

validate-typed-tags-backup: ## Restore and validate a local production backup (BACKUP_FILE=/absolute/path.sql.gz)
	@test -n "$(BACKUP_FILE)" || (echo "BACKUP_FILE is required" >&2; exit 2)
	bash deploy/scripts/validate-typed-tags-backup.sh "$(BACKUP_FILE)"

validate-prod-typed-tags-backup: ## Create, fetch, validate, and delete a fresh production backup (KEEP_BACKUP=1 to retain)
	KEEP_BACKUP="$(KEEP_BACKUP)" LOCAL_BACKUP_DIR="$(LOCAL_BACKUP_DIR)" bash deploy/scripts/fetch-and-validate-typed-tags-backup.sh "$(PROD_HOST)" "$(PROD_DIR)"

prod-logs: ## Tail production logs (use: make prod-logs [SERVICE=backend])
	ssh -t $(PROD_HOST) "cd $(PROD_DIR) && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs -f --tail=100 $(SERVICE)"

prod-status: ## Show production container status
	ssh $(PROD_HOST) "cd $(PROD_DIR) && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env ps"

prod-audit-tenant-access: ## Audit tenant migration lockout risk without writing production data
	ssh $(PROD_HOST) "cd $(PROD_DIR) && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec -T db sh -lc 'psql -v ON_ERROR_STOP=1 -U \"\$$POSTGRES_USER\" -d \"\$$POSTGRES_DB\"'" < deploy/scripts/audit-tenant-access.sql

prod-logs-caddy: ## Tail production Caddy logs
	ssh -t $(PROD_HOST) "cd $(PROD_DIR) && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env logs -f --tail=100 caddy"

prod-shell-caddy: ## Open shell in production Caddy container
	ssh -t $(PROD_HOST) "cd $(PROD_DIR) && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec caddy sh"

prod-ssh: ## SSH into production server
	ssh $(PROD_HOST)

prod-shell: ## Open Django shell in production
	ssh -t $(PROD_HOST) "cd $(PROD_DIR) && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec backend python manage.py shell"

prod-bash: ## Open bash shell in production backend container
	ssh -t $(PROD_HOST) "cd $(PROD_DIR) && docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env exec backend bash"
