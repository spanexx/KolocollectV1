const { performance } = require('perf_hooks');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = process.env.API_URL || 'http://localhost:6000';
const TEST_RESULTS_DIR = path.join(__dirname, '..', 'temp');

// Ensure temp directory exists
if (!fs.existsSync(TEST_RESULTS_DIR)) {
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
}

class PerformanceTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {}
    };
  }

  async runAllTests() {
    console.log('🚀 Starting performance baseline tests...');
    
    try {
      // Test API endpoints
      await this.testAPIEndpoints();
      
      // Test database operations
      await this.testDatabaseOperations();
      
      // Test concurrent load
      await this.testConcurrentLoad();
      
      // Generate summary
      this.generateSummary();
      
      // Save results
      this.saveResults();
      
      console.log('✅ Performance baseline tests completed!');
      console.log('📊 Results saved to:', path.join(TEST_RESULTS_DIR, 'performance-baseline.json'));
      
    } catch (error) {
      console.error('❌ Performance tests failed:', error);
      throw error;
    }
  }

  async testAPIEndpoints() {
    console.log('📊 Testing API endpoints...');
    
    const endpoints = [
      { path: '/api/users', method: 'GET', requiresAuth: false },
      { path: '/api/communities', method: 'GET', requiresAuth: false },
      { path: '/api/metrics/summary', method: 'GET', requiresAuth: false }
    ];

    for (const endpoint of endpoints) {
      await this.testEndpoint(endpoint);
    }
  }

  async testEndpoint(endpoint) {
    const iterations = 5;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${API_BASE_URL}${endpoint.path}`,
          timeout: 10000
        });
        
        const end = performance.now();
        const duration = end - start;
        
        times.push({
          duration,
          status: response.status,
          size: JSON.stringify(response.data).length
        });
        
        // Small delay between requests
        await this.sleep(100);
        
      } catch (error) {
        const end = performance.now();
        times.push({
          duration: end - start,
          status: error.response?.status || 0,
          error: error.message,
          size: 0
        });
      }
    }

    const avgDuration = times.reduce((sum, t) => sum + t.duration, 0) / times.length;
    const maxDuration = Math.max(...times.map(t => t.duration));
    const minDuration = Math.min(...times.map(t => t.duration));
    const successRate = times.filter(t => t.status >= 200 && t.status < 400).length / times.length;

    const testResult = {
      endpoint: endpoint.path,
      method: endpoint.method,
      iterations,
      avgDuration: Math.round(avgDuration * 100) / 100,
      minDuration: Math.round(minDuration * 100) / 100,
      maxDuration: Math.round(maxDuration * 100) / 100,
      successRate: Math.round(successRate * 100),
      avgResponseSize: Math.round(times.reduce((sum, t) => sum + t.size, 0) / times.length),
      details: times
    };

    this.results.tests.push(testResult);
    
    console.log(`  ${endpoint.method} ${endpoint.path}: ${testResult.avgDuration}ms avg (${testResult.successRate}% success)`);
  }

  async testDatabaseOperations() {
    console.log('🗄️  Testing database operations...');
    
    // Test database query performance through API
    const dbTests = [
      { name: 'List Communities', path: '/api/communities' },
      { name: 'User Operations', path: '/api/users' }
    ];

    for (const test of dbTests) {
      const start = performance.now();
      
      try {
        const response = await axios.get(`${API_BASE_URL}${test.path}`);
        const end = performance.now();
        
        const testResult = {
          test: 'Database Query',
          operation: test.name,
          duration: Math.round((end - start) * 100) / 100,
          recordCount: Array.isArray(response.data) ? response.data.length : (response.data.data?.length || 1),
          status: 'success'
        };
        
        this.results.tests.push(testResult);
        console.log(`  ${test.name}: ${testResult.duration}ms (${testResult.recordCount} records)`);
        
      } catch (error) {
        const end = performance.now();
        
        const testResult = {
          test: 'Database Query',
          operation: test.name,
          duration: Math.round((end - start) * 100) / 100,
          status: 'error',
          error: error.message
        };
        
        this.results.tests.push(testResult);
        console.log(`  ${test.name}: Failed (${testResult.duration}ms)`);
      }
    }
  }

  async testConcurrentLoad() {
    console.log('⚡ Testing concurrent load...');
    
    const concurrentRequests = 10;
    const endpoint = '/api/communities';
    
    const promises = Array(concurrentRequests).fill().map(async (_, index) => {
      const start = performance.now();
      
      try {
        const response = await axios.get(`${API_BASE_URL}${endpoint}`);
        const end = performance.now();
        
        return {
          requestId: index,
          duration: end - start,
          status: response.status,
          success: true
        };
      } catch (error) {
        const end = performance.now();
        
        return {
          requestId: index,
          duration: end - start,
          status: error.response?.status || 0,
          success: false,
          error: error.message
        };
      }
    });

    const start = performance.now();
    const results = await Promise.all(promises);
    const totalTime = performance.now() - start;

    const successfulRequests = results.filter(r => r.success);
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const successRate = successfulRequests.length / results.length;

    const loadTestResult = {
      test: 'Concurrent Load',
      concurrentRequests,
      totalDuration: Math.round(totalTime * 100) / 100,
      avgRequestDuration: Math.round(avgDuration * 100) / 100,
      successRate: Math.round(successRate * 100),
      requestsPerSecond: Math.round((concurrentRequests / (totalTime / 1000)) * 100) / 100,
      details: results
    };

    this.results.tests.push(loadTestResult);
    
    console.log(`  Concurrent Load: ${loadTestResult.requestsPerSecond} req/s (${loadTestResult.successRate}% success)`);
  }

  generateSummary() {
    const apiTests = this.results.tests.filter(t => t.endpoint);
    const dbTests = this.results.tests.filter(t => t.test === 'Database Query');
    const loadTests = this.results.tests.filter(t => t.test === 'Concurrent Load');

    this.results.summary = {
      api: {
        avgResponseTime: apiTests.length > 0 ? 
          Math.round((apiTests.reduce((sum, t) => sum + t.avgDuration, 0) / apiTests.length) * 100) / 100 : 0,
        avgSuccessRate: apiTests.length > 0 ? 
          Math.round((apiTests.reduce((sum, t) => sum + t.successRate, 0) / apiTests.length) * 100) / 100 : 0,
        endpointCount: apiTests.length
      },
      database: {
        avgQueryTime: dbTests.length > 0 ? 
          Math.round((dbTests.reduce((sum, t) => sum + t.duration, 0) / dbTests.length) * 100) / 100 : 0,
        totalQueries: dbTests.length
      },
      load: loadTests.length > 0 ? {
        maxConcurrentRequests: Math.max(...loadTests.map(t => t.concurrentRequests)),
        avgRequestsPerSecond: Math.round((loadTests.reduce((sum, t) => sum + t.requestsPerSecond, 0) / loadTests.length) * 100) / 100
      } : null
    };

    console.log('\n📈 Performance Summary:');
    console.log(`  API Avg Response Time: ${this.results.summary.api.avgResponseTime}ms`);
    console.log(`  API Avg Success Rate: ${this.results.summary.api.avgSuccessRate}%`);
    console.log(`  DB Avg Query Time: ${this.results.summary.database.avgQueryTime}ms`);
    if (this.results.summary.load) {
      console.log(`  Max Requests/Second: ${this.results.summary.load.avgRequestsPerSecond}`);
    }
  }

  saveResults() {
    const filePath = path.join(TEST_RESULTS_DIR, 'performance-baseline.json');
    fs.writeFileSync(filePath, JSON.stringify(this.results, null, 2));
    
    // Also save a CSV summary for easy analysis
    this.saveCSVSummary();
  }

  saveCSVSummary() {
    const csvPath = path.join(TEST_RESULTS_DIR, 'performance-baseline.csv');
    
    let csvContent = 'Test Type,Endpoint/Operation,Duration (ms),Status,Notes\n';
    
    this.results.tests.forEach(test => {
      if (test.endpoint) {
        csvContent += `API,${test.method} ${test.endpoint},${test.avgDuration},${test.successRate}%,${test.iterations} iterations\n`;
      } else if (test.test === 'Database Query') {
        csvContent += `Database,${test.operation},${test.duration},${test.status},${test.recordCount || 0} records\n`;
      } else if (test.test === 'Concurrent Load') {
        csvContent += `Load Test,Concurrent Requests,${test.totalDuration},${test.successRate}%,${test.concurrentRequests} concurrent\n`;
      }
    });
    
    fs.writeFileSync(csvPath, csvContent);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (require.main === module) {
  const tester = new PerformanceTester();
  
  tester.runAllTests().catch(error => {
    console.error('Performance testing failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceTester;
