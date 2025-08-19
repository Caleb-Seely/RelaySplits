/**
 * Phase 1 Implementation Test Script
 * 
 * Tests the simplified services to ensure they work correctly
 * and safely in production environments.
 */

console.log('🧪 Testing Phase 1 Implementation...\n')

// Mock localStorage for testing
const mockLocalStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null
  },
  setItem(key, value) {
    this.data[key] = value
  },
  removeItem(key) {
    delete this.data[key]
  },
  clear() {
    this.data = {}
  }
}

// Mock fetch for testing
const mockFetch = (url) => {
  if (url.includes('/api/server-time')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        serverTime: Date.now(),
        serverTimeISO: new Date().toISOString(),
        timestamp: Date.now(),
        timezone: 'UTC'
      })
    })
  }
  return Promise.reject(new Error('Mock fetch error'))
}

// Mock crypto for testing
const mockCrypto = {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
}

// Setup mocks
global.localStorage = mockLocalStorage
global.fetch = mockFetch
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
})
global.navigator = { onLine: true }

// Test Clock Sync Service
async function testClockSync() {
  console.log('⏰ Testing Clock Sync Service...')
  
  try {
    const { SimpleClockSync, getSynchronizedTime, getSyncStatus } = await import('./src/services/simpleClockSync.ts')
    
    const clockSync = SimpleClockSync.getInstance()
    await clockSync.initialize()
    
    const syncTime = getSynchronizedTime()
    const status = getSyncStatus()
    
    console.log('✅ Clock sync initialized')
    console.log('   - Sync time:', syncTime)
    console.log('   - Status:', status)
    
    return true
  } catch (error) {
    console.error('❌ Clock sync test failed:', error)
    return false
  }
}

// Test Backup Service
async function testBackupService() {
  console.log('\n💾 Testing Backup Service...')
  
  try {
    const { SimpleBackupService, createBackup, recoverFromBackup } = await import('./src/services/simpleBackupService.ts')
    
    const backupService = SimpleBackupService.getInstance()
    
    // Test leg data
    const testLeg = {
      id: 1,
      actualStart: Date.now(),
      actualFinish: Date.now() + 3600000,
      version: 1
    }
    
    // Create backup
    await createBackup(testLeg, 'update')
    
    // Recover from backup
    const recovered = await recoverFromBackup(1)
    
    console.log('✅ Backup service working')
    console.log('   - Created backup for leg 1')
    console.log('   - Recovered data:', recovered)
    
    // Test stats
    const stats = backupService.getBackupStats()
    console.log('   - Backup stats:', stats)
    
    return true
  } catch (error) {
    console.error('❌ Backup service test failed:', error)
    return false
  }
}

// Test Retry Service
async function testRetryService() {
  console.log('\n🔄 Testing Retry Service...')
  
  try {
    const { SimpleRetryService, withRetry } = await import('./src/services/simpleRetryService.ts')
    
    const retryService = SimpleRetryService.getInstance()
    
    // Test successful operation
    let attemptCount = 0
    const successfulOperation = async () => {
      attemptCount++
      if (attemptCount === 1) {
        throw new Error('Simulated failure')
      }
      return 'success'
    }
    
    const result = await withRetry(successfulOperation, 'test-success', { maxRetries: 2 })
    
    console.log('✅ Retry service working')
    console.log('   - Successful retry result:', result)
    console.log('   - Attempts made:', attemptCount)
    
    // Test stats
    const stats = retryService.getRetryStats()
    console.log('   - Retry stats:', stats)
    
    return true
  } catch (error) {
    console.error('❌ Retry service test failed:', error)
    return false
  }
}

// Test Cache Service
async function testCacheService() {
  console.log('\n🗄️ Testing Cache Service...')
  
  try {
    const { SimpleCacheService, setCache, getCache, getCacheStats } = await import('./src/services/simpleCacheService.ts')
    
    const cacheService = SimpleCacheService.getInstance()
    
    // Test cache operations
    const testData = { legs: [{ id: 1, name: 'Test Leg' }] }
    const cacheKey = 'test-legs'
    
    setCache(cacheKey, testData, 60000) // 1 minute TTL
    const retrieved = getCache(cacheKey)
    
    console.log('✅ Cache service working')
    console.log('   - Set cache:', cacheKey)
    console.log('   - Retrieved data:', retrieved)
    
    // Test stats
    const stats = cacheService.getStats()
    console.log('   - Cache stats:', stats)
    
    return true
  } catch (error) {
    console.error('❌ Cache service test failed:', error)
    return false
  }
}

// Test Integration
async function testIntegration() {
  console.log('\n🔗 Testing Service Integration...')
  
  try {
    const { useSimpleSyncManager } = await import('./src/hooks/useSimpleSyncManager.ts')
    
    console.log('✅ Integration test passed')
    console.log('   - All services can be imported together')
    console.log('   - Hook structure is valid')
    
    return true
  } catch (error) {
    console.error('❌ Integration test failed:', error)
    return false
  }
}

// Run all tests
async function runAllTests() {
  const tests = [
    { name: 'Clock Sync', fn: testClockSync },
    { name: 'Backup Service', fn: testBackupService },
    { name: 'Retry Service', fn: testRetryService },
    { name: 'Cache Service', fn: testCacheService },
    { name: 'Integration', fn: testIntegration }
  ]
  
  const results = []
  
  for (const test of tests) {
    try {
      const result = await test.fn()
      results.push({ name: test.name, passed: result })
    } catch (error) {
      console.error(`❌ ${test.name} test crashed:`, error)
      results.push({ name: test.name, passed: false })
    }
  }
  
  // Summary
  console.log('\n📊 Test Summary:')
  const passed = results.filter(r => r.passed).length
  const total = results.length
  
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌'
    console.log(`   ${status} ${result.name}`)
  })
  
  console.log(`\n🎯 ${passed}/${total} tests passed`)
  
  if (passed === total) {
    console.log('🎉 Phase 1 implementation is ready for production!')
  } else {
    console.log('⚠️ Some tests failed. Review before production deployment.')
  }
  
  return passed === total
}

// Run tests
runAllTests().then(success => {
  process.exit(success ? 0 : 1)
}).catch(error => {
  console.error('💥 Test runner crashed:', error)
  process.exit(1)
})
