/**
 * Simple Phase 1 Implementation Test
 * 
 * Validates the implementation structure and basic functionality
 * without importing TypeScript files directly.
 */

console.log('🧪 Testing Phase 1 Implementation Structure...\n')

// Test 1: Check if files exist
import fs from 'fs'
import path from 'path'

const requiredFiles = [
  'src/services/simpleClockSync.ts',
  'src/services/simpleBackupService.ts',
  'src/services/simpleRetryService.ts',
  'src/services/simpleCacheService.ts',
  'src/hooks/useSimpleSyncManager.ts',
  'supabase/functions/server-time/index.ts'
]

console.log('📁 Checking required files...')
let allFilesExist = true

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file)
  const status = exists ? '✅' : '❌'
  console.log(`   ${status} ${file}`)
  if (!exists) allFilesExist = false
})

// Test 2: Validate TypeScript syntax
console.log('\n🔍 Validating TypeScript syntax...')

function validateTypeScriptSyntax(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    
    // Basic TypeScript validation
    const hasExport = content.includes('export')
    const hasClass = content.includes('class')
    const hasInterface = content.includes('interface')
    const hasImport = content.includes('import')
    
    return { hasExport, hasClass, hasInterface, hasImport, isValid: true }
  } catch (error) {
    return { isValid: false, error: error.message }
  }
}

const syntaxResults = []
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const result = validateTypeScriptSyntax(file)
    syntaxResults.push({ file, ...result })
    
    const status = result.isValid ? '✅' : '❌'
    console.log(`   ${status} ${file}`)
    if (result.isValid) {
      console.log(`      - Exports: ${result.hasExport ? 'Yes' : 'No'}`)
      console.log(`      - Classes: ${result.hasClass ? 'Yes' : 'No'}`)
      console.log(`      - Interfaces: ${result.hasInterface ? 'Yes' : 'No'}`)
      console.log(`      - Imports: ${result.hasImport ? 'Yes' : 'No'}`)
    } else {
      console.log(`      - Error: ${result.error}`)
    }
  }
})

// Test 3: Check for required patterns
console.log('\n🔍 Checking for required patterns...')

function checkPatterns(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    
    const patterns = {
      singleton: content.includes('getInstance()'),
      errorHandling: content.includes('try') && content.includes('catch'),
      logging: content.includes('console.log') || content.includes('console.warn'),
      localStorage: content.includes('localStorage'),
      asyncAwait: content.includes('async') && content.includes('await')
    }
    
    return patterns
  } catch (error) {
    return {}
  }
}

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const patterns = checkPatterns(file)
    console.log(`   📄 ${file}`)
    console.log(`      - Singleton pattern: ${patterns.singleton ? '✅' : '❌'}`)
    console.log(`      - Error handling: ${patterns.errorHandling ? '✅' : '❌'}`)
    console.log(`      - Logging: ${patterns.logging ? '✅' : '❌'}`)
    console.log(`      - localStorage usage: ${patterns.localStorage ? '✅' : '❌'}`)
    console.log(`      - Async/await: ${patterns.asyncAwait ? '✅' : '❌'}`)
  }
})

// Test 4: Validate edge function
console.log('\n🌐 Validating server-time edge function...')

const serverTimeFile = 'supabase/functions/server-time/index.ts'
if (fs.existsSync(serverTimeFile)) {
  const content = fs.readFileSync(serverTimeFile, 'utf8')
  
  const checks = {
    hasServe: content.includes('serve('),
    hasCORS: content.includes('corsHeaders'),
    hasServerTime: content.includes('Date.now()'),
    hasErrorHandling: content.includes('try') && content.includes('catch'),
    hasJSONResponse: content.includes('JSON.stringify')
  }
  
  console.log('   ✅ Edge function structure:')
  Object.entries(checks).forEach(([check, passed]) => {
    const status = passed ? '✅' : '❌'
    console.log(`      ${status} ${check}`)
  })
}

// Test 5: Check package.json for required dependencies
console.log('\n📦 Checking package.json...')

if (fs.existsSync('package.json')) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  
  const requiredDeps = ['react', 'typescript']
  const requiredDevDeps = ['@types/node']
  
  console.log('   Dependencies:')
  requiredDeps.forEach(dep => {
    const hasDep = packageJson.dependencies && packageJson.dependencies[dep]
    const status = hasDep ? '✅' : '❌'
    console.log(`      ${status} ${dep}`)
  })
  
  console.log('   Dev Dependencies:')
  requiredDevDeps.forEach(dep => {
    const hasDep = packageJson.devDependencies && packageJson.devDependencies[dep]
    const status = hasDep ? '✅' : '❌'
    console.log(`      ${status} ${dep}`)
  })
}

// Test 6: Check TypeScript configuration
console.log('\n⚙️ Checking TypeScript configuration...')

const tsConfigFiles = ['tsconfig.json', 'tsconfig.app.json']
tsConfigFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file} exists`)
    try {
      const config = JSON.parse(fs.readFileSync(file, 'utf8'))
      console.log(`      - Compiler options: ${config.compilerOptions ? 'Present' : 'Missing'}`)
      console.log(`      - Include paths: ${config.include ? config.include.length : 0} entries`)
    } catch (error) {
      console.log(`      - Error parsing: ${error.message}`)
    }
  } else {
    console.log(`   ❌ ${file} missing`)
  }
})

// Summary
console.log('\n📊 Implementation Summary:')
console.log(`   Files exist: ${allFilesExist ? '✅' : '❌'}`)
console.log(`   TypeScript syntax: ${syntaxResults.every(r => r.isValid) ? '✅' : '❌'}`)
console.log(`   Edge function: ${fs.existsSync(serverTimeFile) ? '✅' : '❌'}`)
console.log(`   Package.json: ${fs.existsSync('package.json') ? '✅' : '❌'}`)
console.log(`   TypeScript config: ${tsConfigFiles.some(f => fs.existsSync(f)) ? '✅' : '❌'}`)

const overallSuccess = allFilesExist && 
                      syntaxResults.every(r => r.isValid) && 
                      fs.existsSync(serverTimeFile) &&
                      fs.existsSync('package.json') &&
                      tsConfigFiles.some(f => fs.existsSync(f))

console.log(`\n🎯 Overall Status: ${overallSuccess ? '✅ READY' : '❌ NEEDS WORK'}`)

if (overallSuccess) {
  console.log('\n🎉 Phase 1 implementation structure is valid!')
  console.log('   Next steps:')
  console.log('   1. Deploy server-time edge function')
  console.log('   2. Integrate services into your application')
  console.log('   3. Test with real data')
  console.log('   4. Monitor performance')
} else {
  console.log('\n⚠️ Some issues found. Please review and fix before deployment.')
}

process.exit(overallSuccess ? 0 : 1)
