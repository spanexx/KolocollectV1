// Simple cache test for verification
const { getCacheService } = require('./utils/centralCacheService');

async function simpleCacheTest() {
  try {
    console.log('🚀 Simple Cache Test Starting...');
    
    console.log('1. Getting cache service...');
    const cacheService = await getCacheService();
    console.log('✅ Cache service obtained');
    
    console.log('2. Testing basic operations...');
    await cacheService.set('test:simple', 'Hello World', 60);
    const value = await cacheService.get('test:simple');
    console.log('✅ Cache set/get test:', value);
    
    console.log('3. Getting cache stats...');
    const stats = await cacheService.getStats();
    console.log('✅ Cache stats obtained');
    
    console.log('🎉 Cache system is working correctly!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

simpleCacheTest();
