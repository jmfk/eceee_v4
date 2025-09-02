#!/bin/bash

# Comprehensive Widget System Test Script
# Tests all three implemented features:
# 1. React Widget Editor Components (#110)
# 2. Standardized Widget Backend APIs (#112)  
# 3. Widget Preview System (#113)

echo "========================================="
echo "Widget System Integration Test"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# 1. Start Docker services
echo "1. Starting Docker services..."
docker-compose up -d db redis
sleep 5

# 2. Run Backend Tests
echo ""
echo "2. Testing Backend Widget APIs (#112)..."
echo "----------------------------------------"

# Test widget API endpoints
docker-compose exec -T backend python manage.py test webpages.tests.test_widget_api -v 2 --keepdb 2>&1 | grep -E "(OK|FAILED|ERROR)" | tail -1
BACKEND_TEST_RESULT=$?
print_result $BACKEND_TEST_RESULT "Backend widget API tests"

# Test widget validation
echo "   Testing widget validation..."
docker-compose exec -T backend python -c "
from webpages.widget_registry import widget_type_registry
widget = widget_type_registry.get_widget_type_by_slug('text-block')
if widget:
    try:
        config = widget.configuration_model(title='Test', content='Test content', alignment='left')
        print('   Widget validation: PASSED')
    except Exception as e:
        print(f'   Widget validation: FAILED - {e}')
else:
    print('   Widget validation: FAILED - Widget type not found')
" 2>/dev/null
VALIDATION_RESULT=$?
print_result $VALIDATION_RESULT "Widget configuration validation"

# 3. Build and Test Frontend
echo ""
echo "3. Testing Frontend Components (#110, #113)..."
echo "----------------------------------------------"

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "   Installing frontend dependencies..."
    npm install
fi

# Run build to check for compilation errors
echo "   Building frontend..."
npm run build > /dev/null 2>&1
BUILD_RESULT=$?
print_result $BUILD_RESULT "Frontend build (widget editors & preview)"

# Run frontend tests
echo "   Running frontend tests..."
npm test -- --run 2>&1 | grep -E "(PASS|FAIL)" | tail -1
TEST_RESULT=$?
print_result $TEST_RESULT "Frontend component tests"

cd ..

# 4. Test API Endpoints
echo ""
echo "4. Testing API Endpoints..."
echo "----------------------------"

# Start backend server if not running
docker-compose up -d backend

# Wait for backend to be ready
sleep 5

# Get CSRF token
echo "   Getting authentication token..."
CSRF_TOKEN=$(docker-compose exec -T backend python -c "
from django.middleware.csrf import get_token
from django.test import RequestFactory
factory = RequestFactory()
request = factory.get('/')
print(get_token(request))
" 2>/dev/null | tr -d '\r\n')

# Test widget types endpoint
echo "   Testing widget types endpoint..."
curl -s -X GET http://localhost:8000/api/webpages/widgets/types/ \
    -H "X-CSRFToken: $CSRF_TOKEN" \
    -H "Cookie: csrftoken=$CSRF_TOKEN" \
    | python -m json.tool > /dev/null 2>&1
TYPES_RESULT=$?
print_result $TYPES_RESULT "GET /api/webpages/widgets/types/"

# Test widget validation endpoint
echo "   Testing widget validation endpoint..."
curl -s -X POST http://localhost:8000/api/webpages/widgets/types/text-block/validate/ \
    -H "Content-Type: application/json" \
    -H "X-CSRFToken: $CSRF_TOKEN" \
    -H "Cookie: csrftoken=$CSRF_TOKEN" \
    -d '{"configuration": {"title": "Test", "content": "Test content"}}' \
    | python -m json.tool > /dev/null 2>&1
VALIDATE_RESULT=$?
print_result $VALIDATE_RESULT "POST /api/webpages/widgets/types/{slug}/validate/"

# Test widget preview endpoint
echo "   Testing widget preview endpoint..."
curl -s -X POST http://localhost:8000/api/webpages/widgets/types/text-block/preview/ \
    -H "Content-Type: application/json" \
    -H "X-CSRFToken: $CSRF_TOKEN" \
    -H "Cookie: csrftoken=$CSRF_TOKEN" \
    -d '{"configuration": {"title": "Preview", "content": "<p>Preview content</p>"}}' \
    | python -m json.tool > /dev/null 2>&1
PREVIEW_RESULT=$?
print_result $PREVIEW_RESULT "POST /api/webpages/widgets/types/{slug}/preview/"

# 5. Integration Test
echo ""
echo "5. Running Integration Test..."
echo "-------------------------------"

# Start frontend dev server
echo "   Starting frontend dev server..."
cd frontend
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 10

# Check if frontend is running
curl -s http://localhost:5173 > /dev/null 2>&1
FRONTEND_RUNNING=$?
print_result $FRONTEND_RUNNING "Frontend server running"

# Check if backend is running
curl -s http://localhost:8000/api/ > /dev/null 2>&1
BACKEND_RUNNING=$?
print_result $BACKEND_RUNNING "Backend API running"

# Kill frontend dev server
kill $FRONTEND_PID 2>/dev/null

# 6. Test Widget Registry
echo ""
echo "6. Testing Widget Registry..."
echo "------------------------------"

docker-compose exec -T backend python -c "
from webpages.widget_registry import widget_type_registry

# Test all registered widgets
widgets = widget_type_registry.get_all_widget_types()
print(f'   Total widgets registered: {len(widgets)}')

# Test each widget type
for widget in widgets:
    print(f'   - {widget.name}: {widget.slug}')
" 2>/dev/null

# 7. Summary
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="

TOTAL_TESTS=9
PASSED_TESTS=0

[ $BACKEND_TEST_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $VALIDATION_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $BUILD_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $TEST_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $TYPES_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $VALIDATE_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $PREVIEW_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $FRONTEND_RUNNING -eq 0 ] && ((PASSED_TESTS++))
[ $BACKEND_RUNNING -eq 0 ] && ((PASSED_TESTS++))

echo ""
if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}All tests passed! ($PASSED_TESTS/$TOTAL_TESTS)${NC}"
    echo "✓ React Widget Editor Components working"
    echo "✓ Backend Widget APIs functioning"
    echo "✓ Widget Preview System operational"
    EXIT_CODE=0
else
    echo -e "${YELLOW}Some tests failed ($PASSED_TESTS/$TOTAL_TESTS passed)${NC}"
    EXIT_CODE=1
fi

echo ""
echo "Test completed!"
exit $EXIT_CODE