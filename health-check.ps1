# KoloCollect Health Check Script
# Run this script to check the health of all Docker services

param(
    [switch]$Detailed,
    [switch]$Json
)

$services = @{
    "MongoDB" = @{
        "container" = "kolocollect-mongo"
        "healthcheck" = "docker-compose exec mongodb mongosh --eval `"db.adminCommand('ping')`""
        "port" = 27017
    }
    "Redis" = @{
        "container" = "kolocollect-redis"  
        "healthcheck" = "docker-compose exec redis redis-cli ping"
        "port" = 6379
    }
    "Backend" = @{
        "container" = "kolocollect-backend"
        "healthcheck" = "curl -f http://localhost:9000/api/health"
        "port" = 9000
        "url" = "http://localhost:9000/api/health"
    }
    "Frontend" = @{
        "container" = "kolocollect-frontend"
        "healthcheck" = "curl -f http://localhost:4200/health"
        "port" = 4200
        "url" = "http://localhost:4200/health"
    }
}

$results = @{}

Write-Host "🔍 KoloCollect Health Check" -ForegroundColor Blue
Write-Host "============================" -ForegroundColor Blue
Write-Host ""

foreach ($serviceName in $services.Keys) {
    $service = $services[$serviceName]
    $containerStatus = docker ps --filter "name=$($service.container)" --format "{{.Status}}"
    
    $healthStatus = @{
        "service" = $serviceName
        "container" = $service.container
        "running" = $containerStatus -like "*Up*"
        "healthy" = $false
        "response_time" = $null
        "error" = $null
    }
    
    if ($healthStatus.running) {
        try {
            $startTime = Get-Date
            $null = Invoke-Expression $service.healthcheck 2>$null
            $endTime = Get-Date
            $responseTime = ($endTime - $startTime).TotalMilliseconds
            
            if ($LASTEXITCODE -eq 0) {
                $healthStatus.healthy = $true
                $healthStatus.response_time = [math]::Round($responseTime, 2)
                Write-Host "✅ $serviceName is healthy" -ForegroundColor Green
                if ($Detailed) {
                    Write-Host "   Container: $($service.container)" -ForegroundColor Gray
                    Write-Host "   Port: $($service.port)" -ForegroundColor Gray
                    Write-Host "   Response time: $($healthStatus.response_time)ms" -ForegroundColor Gray
                }
            } else {
                $healthStatus.error = "Health check failed"
                Write-Host "❌ $serviceName is not responding" -ForegroundColor Red
            }
        } catch {
            $healthStatus.error = $_.Exception.Message
            Write-Host "❌ $serviceName health check error: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        $healthStatus.error = "Container not running"
        Write-Host "🔴 $serviceName container is not running" -ForegroundColor Red
    }
    
    $results[$serviceName] = $healthStatus
}

Write-Host ""

# Summary
$totalServices = $services.Count
$healthyServices = ($results.Values | Where-Object { $_.healthy }).Count
$runningServices = ($results.Values | Where-Object { $_.running }).Count

Write-Host "📊 Summary:" -ForegroundColor Yellow
Write-Host "   Running: $runningServices/$totalServices" -ForegroundColor $(if ($runningServices -eq $totalServices) { "Green" } else { "Red" })
Write-Host "   Healthy: $healthyServices/$totalServices" -ForegroundColor $(if ($healthyServices -eq $totalServices) { "Green" } else { "Red" })

if ($Json) {
    Write-Host ""
    Write-Host "📄 JSON Output:" -ForegroundColor Yellow
    $results | ConvertTo-Json -Depth 3
}

if ($Detailed) {
    Write-Host ""
    Write-Host "🐳 Container Details:" -ForegroundColor Yellow
    docker-compose ps
}

# Exit with error code if not all services are healthy
if ($healthyServices -lt $totalServices) {
    exit 1
} else {
    exit 0
}
