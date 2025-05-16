# SCSS Optimization Checks
Write-Host "===== SCSS and Bundle Optimization Checks =====" -ForegroundColor Cyan

# Step 1: Check SCSS file sizes
Write-Host "`nStep 1: Checking SCSS file sizes..." -ForegroundColor Yellow
npm run check-scss

# Step 2: Build for production and analyze
Write-Host "`nStep 2: Building for production to check bundle sizes..." -ForegroundColor Yellow
Write-Host "This will take a few minutes..." -ForegroundColor Gray

try {
    npm run build:prod
    Write-Host "`nBuild completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "`nBuild failed. Please check the error messages above." -ForegroundColor Red
    exit
}

# Step 3: Check total bundle size
Write-Host "`nStep 3: Analyzing bundle sizes..." -ForegroundColor Yellow
Write-Host "To see detailed bundle analysis, run: npm run build:analyze" -ForegroundColor Gray

# Check if the main bundle exists and report its size
$mainBundlePath = Get-ChildItem "dist\kolocollect-frontend\browser\main.*.js" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($mainBundlePath) {
    $mainBundleSize = (Get-Item $mainBundlePath).Length / 1KB
    $mainBundleSizeFormatted = "{0:N2}" -f $mainBundleSize
    
    Write-Host "`nMain bundle size: $mainBundleSizeFormatted KB" -ForegroundColor Cyan
    
    if ($mainBundleSize -gt 750) {
        Write-Host "⚠️ Main bundle exceeds warning threshold (750KB)" -ForegroundColor Yellow
    } elseif ($mainBundleSize -gt 1500) {
        Write-Host "❌ Main bundle exceeds error threshold (1500KB)" -ForegroundColor Red
    } else {
        Write-Host "✅ Main bundle is within size limits!" -ForegroundColor Green
    }
} else {
    Write-Host "`nCould not find main bundle file to analyze size." -ForegroundColor Red
}

# Report check completion
Write-Host "`nOptimization checks completed!" -ForegroundColor Green
Write-Host "To view a detailed bundle analysis in your browser, run:" -ForegroundColor Cyan
Write-Host "npm run build:analyze" -ForegroundColor White
