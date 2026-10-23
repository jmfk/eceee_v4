# Start and validate the local services required by make test.
prepare-test-infra: ## Start the isolated test infrastructure.
	@command -v docker >/dev/null 2>&1 || (echo "Error: Docker is required to run tests."; exit 1)
	@if [ -z "$(CI)" ] && [ -z "$(SKIP_PORT_REGISTRY_CHECK)" ]; then \
		python3 scripts/configure_orbstack.py --runtime-check >/dev/null; \
	fi
	@set -e; \
	echo "Starting isolated ephemeral test infrastructure..."; \
	$(COMPOSE_TEST) up -d test-db test-redis test-minio test-minio-init; \
	echo "Waiting for Postgres..."; \
	i=0; \
	until $(COMPOSE_TEST) exec -T test-db pg_isready -U postgres -d eceee_v4_test >/dev/null 2>&1; do \
		i=$$((i + 1)); \
		if [ $$i -ge 30 ]; then echo "Error: Postgres did not become ready."; exit 1; fi; \
		sleep 1; \
	done

test-infra-down: ## Stop and remove only ECEEE's disposable test services and data.
	$(COMPOSE_TEST) down -v

# Clear stale local Postgres collation metadata before creating Django test databases.
refresh-db-collation: prepare-test-infra
	$(COMPOSE_TEST) exec -T test-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
		-c "UPDATE pg_database SET datcollversion = NULL WHERE datname IN ('template1', 'postgres', 'test_eceee_v4_test');" >/dev/null

# Run backend tests
# The real profile-install API regression also exercises the operator CLI, which
# lives outside the backend image. Mount only its source dependencies read-only.
DEFINITION_TEST_SOURCES = \
	-v "$(CURDIR)/scripts:/definition-tooling/scripts:ro" \
	-v "$(CURDIR)/skills/eceee-api-operations:/definition-tooling/skills/eceee-api-operations:ro" \
	-v "$(CURDIR)/backend/content_migration/legacy_content/profile.py:/definition-tooling/backend/content_migration/legacy_content/profile.py:ro"

backend-test: prepare-test-infra refresh-db-collation ## Run the backend test suite.
	$(COMPOSE_DEV) run --rm --no-deps -T \
		$(DEFINITION_TEST_SOURCES) \
		-e DJANGO_TESTING=1 -e DJANGO_TEST_DATABASE=postgres \
		-e POSTGRES_DB=eceee_v4_test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=test-only \
		-e POSTGRES_HOST=test-db -e POSTGRES_PORT=5432 \
		-e DATABASE_URL=postgresql://postgres:test-only@test-db:5432/eceee_v4_test \
		-e REDIS_URL=redis://test-redis:6379/0 \
		-e AWS_ACCESS_KEY_ID=test-eceee -e AWS_SECRET_ACCESS_KEY=test-eceee-secret \
		-e AWS_S3_INTERNAL_ENDPOINT_URL=http://test-minio:9000 \
		backend sh -c 'python manage.py test --keepdb --verbosity=2 --failfast --noinput && pytest taxonomy/tests/test_governance.py taxonomy/tests/test_assignments.py taxonomy/tests/test_required_media.py --ds=config.settings --reuse-db -q'

# Run the focused News migration suite against PostgreSQL. Historical migrations
# contain PostgreSQL-native ArrayFields and therefore cannot be validated on SQLite.
backend-news-test: prepare-test-infra refresh-db-collation ## Run focused News migration tests.
	$(COMPOSE_DEV) run --rm --no-deps -T \
		-e DJANGO_TESTING=1 -e DJANGO_TEST_DATABASE=postgres \
		-e POSTGRES_DB=eceee_v4_test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=test-only \
		-e POSTGRES_HOST=test-db -e POSTGRES_PORT=5432 \
		-e DATABASE_URL=postgresql://postgres:test-only@test-db:5432/eceee_v4_test \
		-e REDIS_URL=redis://test-redis:6379/0 \
		-e AWS_ACCESS_KEY_ID=test-eceee -e AWS_SECRET_ACCESS_KEY=test-eceee-secret \
		-e AWS_S3_INTERNAL_ENDPOINT_URL=http://test-minio:9000 \
		backend pytest \
			content_migration/tests/test_migrate_legacy_news_command.py \
			content_migration/tests/test_legacy_news_api.py \
			content_migration/tests/test_legacy_news_ai_tags.py \
			content_migration/tests/test_legacy_news_extractor.py \
			content_migration/tests/test_legacy_news_fetcher.py \
			content_migration/tests/test_legacy_news_links.py \
			content_migration/tests/test_legacy_news_media.py \
			content_migration/tests/test_legacy_news_preview.py \
			content_migration/tests/test_legacy_news_repository.py \
			content_migration/tests/test_legacy_news_transformer.py \
			easy_widgets/tests/test_content_widget.py \
			easy_widgets/tests/test_news_detail_widget.py \
			easy_widgets/tests/test_table_widget.py \
			utils/tests/test_security_filters.py -q

# Run backend tests in parallel once the suite is stable.
backend-test-parallel: prepare-test-infra refresh-db-collation ## Run backend tests in parallel.
	$(COMPOSE_DEV) run --rm --no-deps -T \
		$(DEFINITION_TEST_SOURCES) \
		-e DJANGO_TESTING=1 -e DJANGO_TEST_DATABASE=postgres \
		-e POSTGRES_DB=eceee_v4_test -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=test-only \
		-e POSTGRES_HOST=test-db -e POSTGRES_PORT=5432 \
		-e DATABASE_URL=postgresql://postgres:test-only@test-db:5432/eceee_v4_test \
		-e REDIS_URL=redis://test-redis:6379/0 \
		-e AWS_ACCESS_KEY_ID=test-eceee -e AWS_SECRET_ACCESS_KEY=test-eceee-secret \
		-e AWS_S3_INTERNAL_ENDPOINT_URL=http://test-minio:9000 \
		backend sh -c 'python manage.py test --keepdb --parallel auto --verbosity=2 --failfast --noinput && pytest taxonomy/tests/test_governance.py taxonomy/tests/test_assignments.py taxonomy/tests/test_required_media.py --ds=config.settings --reuse-db -q'

# Run frontend tests
frontend-test: prepare-test-infra ## Run frontend unit tests.
	$(COMPOSE_DEV) run --rm --no-deps -T frontend npm run test:run -- --bail=1

# Run all tests
test: backend-test frontend-test ## Run backend and frontend tests.

# Rebuild app containers before running all tests.
test-build: TEST_UP_FLAGS=--build
test-build: test

# Run the full suite with parallel backend tests.
test-parallel: backend-test-parallel frontend-test

# Populate the platform-specific node_modules volumes used by the frontend and
# Playwright runner. The frontend image uses musl while Playwright uses glibc.
prepare-frontend-e2e:
	$(COMPOSE_DEV) run --rm --no-deps -T frontend npm ci
	$(COMPOSE_DEV) run --rm --no-deps -T frontend-e2e npm ci

# Run admin browser regression tests
frontend-admin-e2e-test: prepare-frontend-e2e
	$(COMPOSE_DEV) up -d --force-recreate frontend
	@FP=$${FRONTEND_PORT:-10100}; \
	echo "Waiting for frontend on http://127.0.0.1:$$FP..."; \
	i=0; \
	until curl -fsS "http://127.0.0.1:$$FP/" >/dev/null 2>&1; do \
		i=$$((i + 1)); \
		if [ $$i -ge 60 ]; then echo "Error: frontend did not become ready."; exit 1; fi; \
		sleep 1; \
	done
	$(COMPOSE_DEV) run --rm --no-deps -T \
		-e CI=1 \
		-e PLAYWRIGHT_BASE_URL=http://frontend:3000 \
		frontend-e2e npm run test:e2e:admin

# Run frontend browser regression tests. Retired-renderer HTTP checks run in backend-test.
frontend-e2e-test: frontend-admin-e2e-test

# Run browser regression tests
regression-test: frontend-e2e-test

# Test Playwright service endpoints
playwright-test:
	cd playwright-service && python test_service.py

# Lint backend Python code
backend-lint:
	@files=$$(git diff --name-only --diff-filter=ACMRT $(PY_LINT_BASE)...HEAD -- 'backend/*.py' 'backend/**/*.py' ':(exclude)backend/**/migrations/**' | sed 's#^backend/##' | tr '\n' ' '); \
	if [ -z "$$(echo "$$files" | xargs)" ]; then \
		echo "No changed backend Python files to lint."; \
		exit 0; \
	fi; \
	echo "Linting changed backend Python files: $$files"; \
	$(COMPOSE_DEV) run --rm --no-deps -T backend sh -c "black --check $$files && isort --check-only $$files && flake8 $$files"

# Lint frontend code
frontend-lint:
	cd frontend && npm run lint
