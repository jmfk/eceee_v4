/**
 * Comprehensive Performance Benchmarks for Unified Widget System
 * 
 * This suite measures performance across all aspects of the widget system:
 * - Widget rendering performance
 * - API response times
 * - Memory usage
 * - Load testing with many widgets
 * - Editor performance
 */

import { performance } from 'perf_hooks';
import puppeteer from 'puppeteer';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const CONFIG = {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    apiUrl: process.env.API_BASE_URL || 'http://localhost:8000',
    testDuration: 30000, // 30 seconds
    concurrentUsers: 10,
    maxWidgetsPerPage: 100,
    performanceThresholds: {
        widgetRenderTime: 100, // ms
        apiResponseTime: 500, // ms
        editorLoadTime: 3000, // ms
        previewGenerationTime: 1000, // ms
        memoryUsageIncrease: 50 // MB
    }
};

class WidgetPerformanceBenchmarks {
    constructor() {
        this.browser = null;
        this.results = {
            timestamp: new Date().toISOString(),
            testSuite: 'Unified Widget System Performance',
            benchmarks: {}
        };
    }

    async setup() {
        console.log('🚀 Setting up performance benchmarks...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        console.log('✅ Browser setup complete');
    }

    async teardown() {
        if (this.browser) {
            await this.browser.close();
        }

        // Save results
        const resultsPath = path.join(process.cwd(), 'tests/performance/results');
        await fs.mkdir(resultsPath, { recursive: true });

        const filename = `widget-performance-${Date.now()}.json`;
        await fs.writeFile(
            path.join(resultsPath, filename),
            JSON.stringify(this.results, null, 2)
        );

        console.log(`📊 Results saved to: ${filename}`);
    }

    async measureTime(name, fn) {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        const duration = end - start;

        console.log(`⏱️  ${name}: ${duration.toFixed(2)}ms`);
        return { duration, result };
    }

    async benchmarkWidgetRendering() {
        console.log('\n🎨 Benchmarking widget rendering performance...');

        const page = await this.browser.newPage();
        const results = {};

        // Test different widget types
        const widgetTypes = [
            'text-block',
            'image',
            'button',
            'gallery',
            'html-block',
            'spacer'
        ];

        for (const widgetType of widgetTypes) {
            console.log(`Testing ${widgetType} widget...`);

            const { duration } = await this.measureTime(
                `${widgetType} render`,
                async () => {
                    await page.goto(`${CONFIG.baseUrl}/test/widgets/${widgetType}?config=default`);
                    await page.waitForSelector('.widget-container', { timeout: 10000 });
                    return true;
                }
            );

            results[widgetType] = {
                renderTime: duration,
                threshold: CONFIG.performanceThresholds.widgetRenderTime,
                passed: duration < CONFIG.performanceThresholds.widgetRenderTime
            };
        }

        // Test multiple widgets on same page
        console.log('Testing multiple widgets performance...');
        const multipleWidgetsResults = [];

        for (let count = 1; count <= 50; count += 10) {
            const { duration } = await this.measureTime(
                `${count} widgets`,
                async () => {
                    await page.goto(`${CONFIG.baseUrl}/test/pages/multiple-widgets?count=${count}`);
                    await page.waitForSelector(`[data-testid="widget-preview-${count - 1}"]`, { timeout: 15000 });
                    return true;
                }
            );

            multipleWidgetsResults.push({
                widgetCount: count,
                renderTime: duration,
                averagePerWidget: duration / count
            });
        }

        results.multipleWidgets = multipleWidgetsResults;

        await page.close();
        this.results.benchmarks.widgetRendering = results;

        console.log('✅ Widget rendering benchmarks complete');
    }

    async benchmarkAPIPerformance() {
        console.log('\n🌐 Benchmarking API performance...');

        const results = {};

        // Test widget types endpoint
        const { duration: widgetTypesTime } = await this.measureTime(
            'Widget types API',
            async () => {
                const response = await axios.get(`${CONFIG.apiUrl}/api/v1/widgets/types/`);
                return response.data;
            }
        );

        results.widgetTypes = {
            responseTime: widgetTypesTime,
            threshold: CONFIG.performanceThresholds.apiResponseTime,
            passed: widgetTypesTime < CONFIG.performanceThresholds.apiResponseTime
        };

        // Test widget validation
        const { duration: validationTime } = await this.measureTime(
            'Widget validation API',
            async () => {
                const response = await axios.post(`${CONFIG.apiUrl}/api/v1/widgets/types/text-block/validate/`, {
                    configuration: {
                        title: 'Performance Test',
                        content: 'Performance test content',
                        alignment: 'left'
                    }
                });
                return response.data;
            }
        );

        results.validation = {
            responseTime: validationTime,
            threshold: CONFIG.performanceThresholds.apiResponseTime,
            passed: validationTime < CONFIG.performanceThresholds.apiResponseTime
        };

        // Test widget preview generation
        const { duration: previewTime } = await this.measureTime(
            'Widget preview API',
            async () => {
                const response = await axios.post(`${CONFIG.apiUrl}/api/v1/widgets/types/text-block/preview/`, {
                    configuration: {
                        title: 'Performance Test Preview',
                        content: '<p>Performance test content with <strong>HTML</strong></p>',
                        alignment: 'center'
                    }
                });
                return response.data;
            }
        );

        results.preview = {
            responseTime: previewTime,
            threshold: CONFIG.performanceThresholds.previewGenerationTime,
            passed: previewTime < CONFIG.performanceThresholds.previewGenerationTime
        };

        // Test concurrent API requests
        console.log('Testing concurrent API performance...');
        const concurrentRequests = 20;
        const startTime = performance.now();

        const promises = Array.from({ length: concurrentRequests }, () =>
            axios.get(`${CONFIG.apiUrl}/api/v1/widgets/types/`)
        );

        await Promise.all(promises);
        const concurrentTime = performance.now() - startTime;

        results.concurrent = {
            totalTime: concurrentTime,
            requestCount: concurrentRequests,
            averageTime: concurrentTime / concurrentRequests,
            requestsPerSecond: (concurrentRequests / concurrentTime) * 1000
        };

        this.results.benchmarks.apiPerformance = results;

        console.log('✅ API performance benchmarks complete');
    }

    async benchmarkEditorPerformance() {
        console.log('\n📝 Benchmarking editor performance...');

        const page = await this.browser.newPage();
        const results = {};

        // Enable performance monitoring
        await page.setCacheEnabled(false);

        // Test empty page editor load
        const { duration: emptyEditorTime } = await this.measureTime(
            'Empty page editor load',
            async () => {
                await page.goto(`${CONFIG.baseUrl}/pages/new`);
                await page.waitForSelector('[data-testid="page-editor"]', { timeout: 15000 });
                return true;
            }
        );

        results.emptyEditor = {
            loadTime: emptyEditorTime,
            threshold: CONFIG.performanceThresholds.editorLoadTime,
            passed: emptyEditorTime < CONFIG.performanceThresholds.editorLoadTime
        };

        // Test editor with many widgets
        const { duration: loadedEditorTime } = await this.measureTime(
            'Editor with 50 widgets',
            async () => {
                await page.goto(`${CONFIG.baseUrl}/test/pages/editor-with-widgets?count=50`);
                await page.waitForSelector('[data-testid="page-editor"]', { timeout: 20000 });
                await page.waitForSelector('[data-testid="widget-preview-49"]', { timeout: 20000 });
                return true;
            }
        );

        results.loadedEditor = {
            loadTime: loadedEditorTime,
            widgetCount: 50,
            averageTimePerWidget: loadedEditorTime / 50
        };

        // Test widget operations performance
        await page.goto(`${CONFIG.baseUrl}/pages/new`);
        await page.waitForSelector('[data-testid="page-editor"]');

        // Add widget performance
        const { duration: addWidgetTime } = await this.measureTime(
            'Add widget operation',
            async () => {
                await page.click('[data-testid="add-widget-button"]');
                await page.waitForSelector('[data-testid="widget-library"]');
                await page.click('[data-testid="widget-text-block"]');
                await page.waitForSelector('[data-testid="widget-config-form"]');
                return true;
            }
        );

        results.addWidget = {
            operationTime: addWidgetTime,
            threshold: 2000, // 2 seconds
            passed: addWidgetTime < 2000
        };

        // Configure widget performance
        const { duration: configureWidgetTime } = await this.measureTime(
            'Configure widget operation',
            async () => {
                await page.fill('[data-testid="title-input"]', 'Performance Test Widget');
                await page.fill('[data-testid="content-input"]', 'Performance test content');
                await page.selectOption('[data-testid="alignment-select"]', 'center');
                await page.click('[data-testid="save-widget-config"]');
                await page.waitForSelector('[data-testid="widget-preview"]');
                return true;
            }
        );

        results.configureWidget = {
            operationTime: configureWidgetTime,
            threshold: 1000, // 1 second
            passed: configureWidgetTime < 1000
        };

        // Test memory usage
        const memoryUsage = await page.evaluate(() => {
            return {
                usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
                totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
                jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || 0
            };
        });

        results.memoryUsage = {
            usedHeapMB: Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024),
            totalHeapMB: Math.round(memoryUsage.totalJSHeapSize / 1024 / 1024),
            heapLimitMB: Math.round(memoryUsage.jsHeapSizeLimit / 1024 / 1024)
        };

        await page.close();
        this.results.benchmarks.editorPerformance = results;

        console.log('✅ Editor performance benchmarks complete');
    }

    async benchmarkLoadTesting() {
        console.log('\n🏋️ Running load tests...');

        const results = {};

        // Test concurrent users on page editor
        console.log('Testing concurrent page editor access...');

        const pages = [];
        const startTime = performance.now();

        // Create multiple browser pages to simulate concurrent users
        for (let i = 0; i < CONFIG.concurrentUsers; i++) {
            const page = await this.browser.newPage();
            pages.push(page);
        }

        // Load page editor concurrently
        const loadPromises = pages.map(async (page, index) => {
            const userStartTime = performance.now();
            await page.goto(`${CONFIG.baseUrl}/pages/new?user=${index}`);
            await page.waitForSelector('[data-testid="page-editor"]', { timeout: 20000 });
            const userEndTime = performance.now();
            return userEndTime - userStartTime;
        });

        const userLoadTimes = await Promise.all(loadPromises);
        const totalTime = performance.now() - startTime;

        results.concurrentUsers = {
            userCount: CONFIG.concurrentUsers,
            totalTime,
            averageLoadTime: userLoadTimes.reduce((a, b) => a + b, 0) / userLoadTimes.length,
            minLoadTime: Math.min(...userLoadTimes),
            maxLoadTime: Math.max(...userLoadTimes),
            userLoadTimes
        };

        // Test widget operations under load
        console.log('Testing widget operations under load...');

        const operationPromises = pages.map(async (page, index) => {
            const operations = [];

            // Add widget
            const addStart = performance.now();
            await page.click('[data-testid="add-widget-button"]');
            await page.waitForSelector('[data-testid="widget-library"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.waitForSelector('[data-testid="widget-config-form"]');
            operations.push({ operation: 'add', time: performance.now() - addStart });

            // Configure widget
            const configStart = performance.now();
            await page.fill('[data-testid="title-input"]', `User ${index} Widget`);
            await page.fill('[data-testid="content-input"]', `Content from user ${index}`);
            await page.click('[data-testid="save-widget-config"]');
            await page.waitForSelector('[data-testid="widget-preview"]');
            operations.push({ operation: 'configure', time: performance.now() - configStart });

            return operations;
        });

        const allOperations = await Promise.all(operationPromises);

        // Analyze operation performance under load
        const addOperations = allOperations.flat().filter(op => op.operation === 'add');
        const configOperations = allOperations.flat().filter(op => op.operation === 'configure');

        results.operationsUnderLoad = {
            addWidget: {
                count: addOperations.length,
                averageTime: addOperations.reduce((a, b) => a + b.time, 0) / addOperations.length,
                minTime: Math.min(...addOperations.map(op => op.time)),
                maxTime: Math.max(...addOperations.map(op => op.time))
            },
            configureWidget: {
                count: configOperations.length,
                averageTime: configOperations.reduce((a, b) => a + b.time, 0) / configOperations.length,
                minTime: Math.min(...configOperations.map(op => op.time)),
                maxTime: Math.max(...configOperations.map(op => op.time))
            }
        };

        // Close all pages
        await Promise.all(pages.map(page => page.close()));

        this.results.benchmarks.loadTesting = results;

        console.log('✅ Load testing complete');
    }

    async benchmarkMemoryUsage() {
        console.log('\n🧠 Benchmarking memory usage...');

        const page = await this.browser.newPage();
        const results = {};

        // Baseline memory usage
        await page.goto(`${CONFIG.baseUrl}/pages/new`);
        await page.waitForSelector('[data-testid="page-editor"]');

        const baselineMemory = await page.evaluate(() => {
            return {
                usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
                totalJSHeapSize: performance.memory?.totalJSHeapSize || 0
            };
        });

        results.baseline = {
            usedHeapMB: Math.round(baselineMemory.usedJSHeapSize / 1024 / 1024),
            totalHeapMB: Math.round(baselineMemory.totalJSHeapSize / 1024 / 1024)
        };

        // Memory usage with many widgets
        const memoryUsageOverTime = [];

        for (let i = 1; i <= 20; i++) {
            // Add widget
            await page.click('[data-testid="add-widget-button"]');
            await page.click('[data-testid="widget-text-block"]');
            await page.fill('[data-testid="title-input"]', `Widget ${i}`);
            await page.fill('[data-testid="content-input"]', `Content for widget ${i}`);
            await page.click('[data-testid="save-widget-config"]');
            await page.waitForSelector(`[data-testid="widget-preview-${i - 1}"]`);

            // Measure memory after each widget
            const memory = await page.evaluate(() => {
                return {
                    usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
                    totalJSHeapSize: performance.memory?.totalJSHeapSize || 0
                };
            });

            memoryUsageOverTime.push({
                widgetCount: i,
                usedHeapMB: Math.round(memory.usedJSHeapSize / 1024 / 1024),
                totalHeapMB: Math.round(memory.totalJSHeapSize / 1024 / 1024)
            });
        }

        results.memoryGrowth = memoryUsageOverTime;

        // Calculate memory increase per widget
        const finalMemory = memoryUsageOverTime[memoryUsageOverTime.length - 1];
        const memoryIncrease = finalMemory.usedHeapMB - results.baseline.usedHeapMB;
        const memoryPerWidget = memoryIncrease / 20;

        results.analysis = {
            totalMemoryIncrease: memoryIncrease,
            memoryPerWidget,
            threshold: CONFIG.performanceThresholds.memoryUsageIncrease,
            passed: memoryIncrease < CONFIG.performanceThresholds.memoryUsageIncrease
        };

        // Test memory cleanup after widget deletion
        console.log('Testing memory cleanup...');

        // Delete all widgets
        for (let i = 19; i >= 0; i--) {
            await page.click(`[data-testid="delete-widget-${i}"]`);
            await page.waitForSelector(`[data-testid="widget-preview-${i}"]`, { state: 'detached' });
        }

        // Force garbage collection if available
        await page.evaluate(() => {
            if (window.gc) {
                window.gc();
            }
        });

        await page.waitForTimeout(2000); // Allow time for cleanup

        const cleanupMemory = await page.evaluate(() => {
            return {
                usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
                totalJSHeapSize: performance.memory?.totalJSHeapSize || 0
            };
        });

        results.cleanup = {
            usedHeapMB: Math.round(cleanupMemory.usedJSHeapSize / 1024 / 1024),
            totalHeapMB: Math.round(cleanupMemory.totalJSHeapSize / 1024 / 1024),
            memoryReclaimed: results.baseline.usedHeapMB - Math.round(cleanupMemory.usedJSHeapSize / 1024 / 1024)
        };

        await page.close();
        this.results.benchmarks.memoryUsage = results;

        console.log('✅ Memory usage benchmarks complete');
    }

    generateReport() {
        console.log('\n📊 Performance Benchmark Report');
        console.log('=' * 50);

        const { benchmarks } = this.results;

        // Widget Rendering Summary
        if (benchmarks.widgetRendering) {
            console.log('\n🎨 Widget Rendering Performance:');
            Object.entries(benchmarks.widgetRendering).forEach(([widget, data]) => {
                if (widget !== 'multipleWidgets') {
                    const status = data.passed ? '✅' : '❌';
                    console.log(`  ${status} ${widget}: ${data.renderTime.toFixed(2)}ms (threshold: ${data.threshold}ms)`);
                }
            });

            if (benchmarks.widgetRendering.multipleWidgets) {
                console.log('\n  Multiple Widgets Performance:');
                benchmarks.widgetRendering.multipleWidgets.forEach(result => {
                    console.log(`    ${result.widgetCount} widgets: ${result.renderTime.toFixed(2)}ms (${result.averagePerWidget.toFixed(2)}ms per widget)`);
                });
            }
        }

        // API Performance Summary
        if (benchmarks.apiPerformance) {
            console.log('\n🌐 API Performance:');
            Object.entries(benchmarks.apiPerformance).forEach(([endpoint, data]) => {
                if (data.responseTime !== undefined) {
                    const status = data.passed ? '✅' : '❌';
                    console.log(`  ${status} ${endpoint}: ${data.responseTime.toFixed(2)}ms (threshold: ${data.threshold}ms)`);
                } else if (endpoint === 'concurrent') {
                    console.log(`  📈 Concurrent requests: ${data.requestsPerSecond.toFixed(2)} req/sec`);
                }
            });
        }

        // Editor Performance Summary
        if (benchmarks.editorPerformance) {
            console.log('\n📝 Editor Performance:');
            const { editorPerformance } = benchmarks;

            if (editorPerformance.emptyEditor) {
                const status = editorPerformance.emptyEditor.passed ? '✅' : '❌';
                console.log(`  ${status} Empty editor load: ${editorPerformance.emptyEditor.loadTime.toFixed(2)}ms`);
            }

            if (editorPerformance.loadedEditor) {
                console.log(`  📊 Editor with 50 widgets: ${editorPerformance.loadedEditor.loadTime.toFixed(2)}ms`);
            }

            if (editorPerformance.memoryUsage) {
                console.log(`  🧠 Memory usage: ${editorPerformance.memoryUsage.usedHeapMB}MB`);
            }
        }

        // Load Testing Summary
        if (benchmarks.loadTesting) {
            console.log('\n🏋️ Load Testing:');
            const { loadTesting } = benchmarks;

            if (loadTesting.concurrentUsers) {
                console.log(`  👥 ${loadTesting.concurrentUsers.userCount} concurrent users:`);
                console.log(`    Average load time: ${loadTesting.concurrentUsers.averageLoadTime.toFixed(2)}ms`);
                console.log(`    Min/Max: ${loadTesting.concurrentUsers.minLoadTime.toFixed(2)}ms / ${loadTesting.concurrentUsers.maxLoadTime.toFixed(2)}ms`);
            }
        }

        // Memory Usage Summary
        if (benchmarks.memoryUsage) {
            console.log('\n🧠 Memory Usage:');
            const { memoryUsage } = benchmarks;

            if (memoryUsage.analysis) {
                const status = memoryUsage.analysis.passed ? '✅' : '❌';
                console.log(`  ${status} Memory increase: ${memoryUsage.analysis.totalMemoryIncrease}MB (threshold: ${memoryUsage.analysis.threshold}MB)`);
                console.log(`  📊 Memory per widget: ${memoryUsage.analysis.memoryPerWidget.toFixed(2)}MB`);
            }
        }

        console.log('\n' + '=' * 50);
        console.log('✅ Performance benchmark report complete');
    }

    async run() {
        try {
            await this.setup();

            await this.benchmarkWidgetRendering();
            await this.benchmarkAPIPerformance();
            await this.benchmarkEditorPerformance();
            await this.benchmarkLoadTesting();
            await this.benchmarkMemoryUsage();

            this.generateReport();

        } catch (error) {
            console.error('❌ Benchmark failed:', error);
            throw error;
        } finally {
            await this.teardown();
        }
    }
}

// Run benchmarks if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const benchmarks = new WidgetPerformanceBenchmarks();
    benchmarks.run().catch(error => {
        console.error('Benchmarks failed:', error);
        process.exit(1);
    });
}

export default WidgetPerformanceBenchmarks;
