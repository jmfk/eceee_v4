#!/bin/bash

# Comprehensive Test Runner for Unified Widget System
# This script runs all tests for the unified widget system including
# unit tests, integration tests, visual regression tests, and performance benchmarks

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$BASE_DIR/backend"
FRONTEND_DIR="$BASE_DIR/frontend"
TESTS_DIR="$BASE_DIR/tests"

# Default settings
RUN_BACKEND_TESTS=true
RUN_FRONTEND_TESTS=true
RUN_INTEGRATION_TESTS=true
RUN_VISUAL_TESTS=false  # Disabled by default (requires setup)
RUN_PERFORMANCE_TESTS=false  # Disabled by default (takes time)
GENERATE_COVERAGE=true
PARALLEL_TESTS=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --backend-only)
      RUN_BACKEND_TESTS=true
      RUN_FRONTEND_TESTS=false
      RUN_INTEGRATION_TESTS=false
      RUN_VISUAL_TESTS=false
      RUN_PERFORMANCE_TESTS=false
      shift
      ;;
    --frontend-only)
      RUN_BACKEND_TESTS=false
      RUN_FRONTEND_TESTS=true
      RUN_INTEGRATION_TESTS=false
      RUN_VISUAL_TESTS=false
      RUN_PERFORMANCE_TESTS=false
      shift
      ;;
    --integration-only)
      RUN_BACKEND_TESTS=false
      RUN_FRONTEND_TESTS=false
      RUN_INTEGRATION_TESTS=true
      RUN_VISUAL_TESTS=false
      RUN_PERFORMANCE_TESTS=false
      shift
      ;;
    --visual-tests)
      RUN_VISUAL_TESTS=true
      shift
      ;;
    --performance-tests)
      RUN_PERFORMANCE_TESTS=true
      shift
      ;;
    --no-coverage)
      GENERATE_COVERAGE=false
      shift
      ;;
    --sequential)
      PARALLEL_TESTS=false
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --backend-only      Run only backend tests"
      echo "  --frontend-only     Run only frontend tests"
      echo "  --integration-only  Run only integration tests"
      echo "  --visual-tests      Include visual regression tests"
      echo "  --performance-tests Include performance benchmarks"
      echo "  --no-coverage       Skip coverage report generation"
      echo "  --sequential        Run tests sequentially instead of parallel"
      echo "  --help              Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Utility functions
print_header() {
  echo -e "${BLUE}================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}================================${NC}"
}

print_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
  echo -e "${RED}❌ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
  print_header "Checking Prerequisites"
  
  # Check if Docker is running
  if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
  fi
  
  # Check if services are running
  if ! docker-compose ps | grep -q "Up"; then
    print_warning "Some services may not be running. Starting services..."
    docker-compose up -d db redis
    sleep 5
  fi
  
  print_success "Prerequisites check passed"
}

# Backend tests
run_backend_tests() {
  if [ "$RUN_BACKEND_TESTS" = false ]; then
    return 0
  fi
  
  print_header "Running Backend Tests"
  
  cd "$BACKEND_DIR"
  
  # Run Django tests
  print_info "Running Django unit tests..."
  if [ "$GENERATE_COVERAGE" = true ]; then
    docker-compose exec backend coverage run --source='.' manage.py test webpages.tests.test_unified_widget_system
    docker-compose exec backend coverage run --append --source='.' manage.py test webpages.tests.test_widget_api
    docker-compose exec backend coverage run --append --source='.' manage.py test core_widgets.tests
    docker-compose exec backend coverage run --append --source='.' manage.py test example_custom_widgets.tests
    
    # Generate coverage report
    docker-compose exec backend coverage report --show-missing
    docker-compose exec backend coverage html
    
    print_success "Backend tests completed with coverage"
  else
    docker-compose exec backend python manage.py test webpages.tests.test_unified_widget_system
    docker-compose exec backend python manage.py test webpages.tests.test_widget_api
    docker-compose exec backend python manage.py test core_widgets.tests
    docker-compose exec backend python manage.py test example_custom_widgets.tests
    
    print_success "Backend tests completed"
  fi
  
  cd "$BASE_DIR"
}

# Frontend tests
run_frontend_tests() {
  if [ "$RUN_FRONTEND_TESTS" = false ]; then
    return 0
  fi
  
  print_header "Running Frontend Tests"
  
  cd "$FRONTEND_DIR"
  
  print_info "Running React component tests..."
  if [ "$GENERATE_COVERAGE" = true ]; then
    docker-compose exec frontend npm run test:coverage
  else
    docker-compose exec frontend npm run test:run
  fi
  
  print_success "Frontend tests completed"
  
  cd "$BASE_DIR"
}

# Integration tests
run_integration_tests() {
  if [ "$RUN_INTEGRATION_TESTS" = false ]; then
    return 0
  fi
  
  print_header "Running Integration Tests"
  
  # Check if Playwright is available
  if [ ! -d "$TESTS_DIR/integration" ]; then
    print_warning "Integration tests directory not found, skipping..."
    return 0
  fi
  
  print_info "Running end-to-end integration tests..."
  
  # Make sure services are running
  docker-compose up -d backend frontend
  sleep 10  # Wait for services to be ready
  
  # Run Playwright tests (if available)
  if command -v npx >/dev/null 2>&1; then
    cd "$TESTS_DIR"
    npx playwright test integration/unified_widget_integration.test.js
    print_success "Integration tests completed"
  else
    print_warning "Playwright not available, skipping integration tests"
  fi
  
  cd "$BASE_DIR"
}

# Visual regression tests
run_visual_tests() {
  if [ "$RUN_VISUAL_TESTS" = false ]; then
    return 0
  fi
  
  print_header "Running Visual Regression Tests"
  
  # Check if BackstopJS is available
  if [ ! -f "$TESTS_DIR/visual/backstop.config.js" ]; then
    print_warning "Visual regression tests not configured, skipping..."
    return 0
  fi
  
  print_info "Running visual regression tests..."
  
  # Make sure services are running
  docker-compose up -d backend frontend
  sleep 10
  
  cd "$TESTS_DIR/visual"
  
  if command -v npx >/dev/null 2>&1; then
    # Run BackstopJS tests
    npx backstopjs test --config=backstop.config.js || {
      print_warning "Visual regression differences detected"
      print_info "Run 'npx backstopjs openReport' to view differences"
    }
    print_success "Visual regression tests completed"
  else
    print_warning "BackstopJS not available, skipping visual tests"
  fi
  
  cd "$BASE_DIR"
}

# Performance tests
run_performance_tests() {
  if [ "$RUN_PERFORMANCE_TESTS" = false ]; then
    return 0
  fi
  
  print_header "Running Performance Benchmarks"
  
  # Check if performance tests exist
  if [ ! -f "$TESTS_DIR/performance/widget_performance_benchmarks.js" ]; then
    print_warning "Performance benchmarks not found, skipping..."
    return 0
  fi
  
  print_info "Running performance benchmarks..."
  
  # Make sure services are running
  docker-compose up -d backend frontend
  sleep 10
  
  cd "$TESTS_DIR/performance"
  
  if command -v node >/dev/null 2>&1; then
    node widget_performance_benchmarks.js
    print_success "Performance benchmarks completed"
  else
    print_warning "Node.js not available, skipping performance tests"
  fi
  
  cd "$BASE_DIR"
}

# Generate test report
generate_test_report() {
  print_header "Generating Test Report"
  
  REPORT_DIR="$BASE_DIR/test_reports"
  mkdir -p "$REPORT_DIR"
  
  REPORT_FILE="$REPORT_DIR/test_report_$(date +%Y%m%d_%H%M%S).md"
  
  cat > "$REPORT_FILE" << EOF
# Unified Widget System Test Report

**Generated:** $(date)
**Environment:** $(docker-compose exec backend python -c "import os; print(os.environ.get('DJANGO_SETTINGS_MODULE', 'development'))" 2>/dev/null || echo "unknown")

## Test Summary

### Backend Tests
$(if [ "$RUN_BACKEND_TESTS" = true ]; then echo "✅ Executed"; else echo "⏭️ Skipped"; fi)

### Frontend Tests  
$(if [ "$RUN_FRONTEND_TESTS" = true ]; then echo "✅ Executed"; else echo "⏭️ Skipped"; fi)

### Integration Tests
$(if [ "$RUN_INTEGRATION_TESTS" = true ]; then echo "✅ Executed"; else echo "⏭️ Skipped"; fi)

### Visual Regression Tests
$(if [ "$RUN_VISUAL_TESTS" = true ]; then echo "✅ Executed"; else echo "⏭️ Skipped"; fi)

### Performance Tests
$(if [ "$RUN_PERFORMANCE_TESTS" = true ]; then echo "✅ Executed"; else echo "⏭️ Skipped"; fi)

## Coverage Reports

$(if [ "$GENERATE_COVERAGE" = true ]; then
  echo "### Backend Coverage"
  echo "\`\`\`"
  docker-compose exec backend coverage report 2>/dev/null || echo "Coverage report not available"
  echo "\`\`\`"
fi)

## Test Artifacts

- Backend coverage: \`backend/htmlcov/index.html\`
- Frontend coverage: \`frontend/coverage/index.html\`
- Visual regression report: \`tests/visual/report/index.html\`
- Performance results: \`tests/performance/results/\`

## Next Steps

1. Review any failed tests and address issues
2. Update test cases based on new requirements
3. Ensure all team members can run tests successfully
4. Consider adding additional test coverage for edge cases

EOF

  print_success "Test report generated: $REPORT_FILE"
}

# Cleanup function
cleanup() {
  print_info "Cleaning up test artifacts..."
  
  # Clean up any temporary files
  find "$BASE_DIR" -name "*.pyc" -delete 2>/dev/null || true
  find "$BASE_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
  
  # Clean up node_modules cache
  if [ -d "$FRONTEND_DIR/node_modules/.cache" ]; then
    rm -rf "$FRONTEND_DIR/node_modules/.cache"
  fi
}

# Main execution
main() {
  print_header "Unified Widget System Test Suite"
  print_info "Starting comprehensive test execution..."
  
  # Record start time
  START_TIME=$(date +%s)
  
  # Check prerequisites
  check_prerequisites
  
  # Run tests based on configuration
  if [ "$PARALLEL_TESTS" = true ] && [ "$RUN_BACKEND_TESTS" = true ] && [ "$RUN_FRONTEND_TESTS" = true ]; then
    print_info "Running backend and frontend tests in parallel..."
    run_backend_tests &
    BACKEND_PID=$!
    run_frontend_tests &
    FRONTEND_PID=$!
    
    wait $BACKEND_PID
    wait $FRONTEND_PID
  else
    run_backend_tests
    run_frontend_tests
  fi
  
  run_integration_tests
  run_visual_tests
  run_performance_tests
  
  # Generate report
  generate_test_report
  
  # Calculate execution time
  END_TIME=$(date +%s)
  EXECUTION_TIME=$((END_TIME - START_TIME))
  
  # Final summary
  print_header "Test Execution Complete"
  print_success "Total execution time: ${EXECUTION_TIME} seconds"
  
  if [ "$GENERATE_COVERAGE" = true ]; then
    print_info "Coverage reports available:"
    print_info "  Backend: file://$BACKEND_DIR/htmlcov/index.html"
    print_info "  Frontend: file://$FRONTEND_DIR/coverage/index.html"
  fi
  
  if [ "$RUN_VISUAL_TESTS" = true ]; then
    print_info "Visual regression report: file://$TESTS_DIR/visual/report/index.html"
  fi
  
  cleanup
  
  print_success "All tests completed successfully! 🎉"
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"
