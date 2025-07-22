# Frontend Tests

## Important: Running Tests

**Always run tests with the `--run` flag to avoid watch mode and memory issues:**

```bash
# ✅ Correct way - runs tests once and exits
docker-compose exec frontend npm run test:run -- --run

# ✅ Correct way - run specific test file
docker-compose exec frontend npm run test:run -- --run TreePageManager.test.jsx

# ❌ Avoid this - runs in watch mode and can cause memory issues
docker-compose exec frontend npm test

# ❌ Avoid this - also runs in watch mode
docker-compose exec frontend npm run test
```

## Why Use --run Flag?

1. **Memory Issues**: Watch mode can cause memory leaks in complex components
2. **CI/CD Compatibility**: Tests should complete and exit for proper CI/CD integration
3. **Performance**: Faster execution without file watching overhead
4. **Stability**: Prevents hanging processes and resource exhaustion

## Test Structure

- `TreePageManager.test.jsx` - Main tree management component tests
- `TreePageManager.simple.test.jsx` - Simplified tests for basic functionality
- `PageTreeNode.test.jsx` - Individual tree node component tests
- `SlotManager.test.jsx` - Widget slot management tests

## Running Specific Tests

```bash
# Run all tests
docker-compose exec frontend npm run test:run -- --run

# Run specific test file
docker-compose exec frontend npm run test:run -- --run TreePageManager.simple.test.jsx

# Run tests matching pattern
docker-compose exec frontend npm run test:run -- --run -t "TreePageManager"

# Run with coverage
docker-compose exec frontend npm run test:run -- --run --coverage
```

## Test Best Practices

1. **Use `--run` flag** for all test commands
2. **Mock external dependencies** to avoid API calls
3. **Keep tests focused** on specific functionality
4. **Use descriptive test names** that explain the expected behavior
5. **Clean up mocks** in `beforeEach` or `afterEach` hooks
6. **Test error states** and edge cases
7. **Avoid complex state management** in tests that could cause memory leaks

## Troubleshooting

### Memory Issues
If tests are running out of memory:
1. Ensure you're using the `--run` flag
2. Check for infinite loops in component logic
3. Simplify complex state management in components
4. Use smaller test datasets

### Hanging Tests
If tests hang or don't complete:
1. Check for unhandled promises
2. Ensure all mocks return proper values
3. Verify React Query is properly configured
4. Check for circular dependencies

### Test Failures
If tests are failing:
1. Check that mocks match the actual API responses
2. Verify component props and expected elements
3. Ensure test data matches component expectations
4. Check for timing issues with async operations 