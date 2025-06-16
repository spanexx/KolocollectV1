# KoloCollect Docker Management Script

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("start", "stop", "restart", "build", "logs", "status", "clean")]
    [string]$Action
)

Write-Host "KoloCollect Docker Management" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green

switch ($Action) {
    "start" {
        Write-Host "Starting KoloCollect services..." -ForegroundColor Yellow
        docker-compose up -d
        Write-Host "Services started! Frontend: http://localhost:4200, Backend: http://localhost:9000" -ForegroundColor Green
    }
    "stop" {
        Write-Host "Stopping KoloCollect services..." -ForegroundColor Yellow
        docker-compose down
        Write-Host "Services stopped!" -ForegroundColor Green
    }
    "restart" {
        Write-Host "Restarting KoloCollect services..." -ForegroundColor Yellow
        docker-compose down
        docker-compose up -d
        Write-Host "Services restarted!" -ForegroundColor Green
    }
    "build" {
        Write-Host "Building and starting KoloCollect services..." -ForegroundColor Yellow
        docker-compose up --build -d
        Write-Host "Services built and started!" -ForegroundColor Green
    }
    "logs" {
        Write-Host "Showing logs for all services..." -ForegroundColor Yellow
        docker-compose logs -f
    }
    "status" {
        Write-Host "Service status:" -ForegroundColor Yellow
        docker-compose ps
        Write-Host "`nHealth checks:" -ForegroundColor Yellow
        docker-compose exec backend curl -f http://localhost:9000/api/health 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Backend is healthy" -ForegroundColor Green
        } else {
            Write-Host "✗ Backend is not responding" -ForegroundColor Red
        }
        
        docker-compose exec frontend curl -f http://localhost/health 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Frontend is healthy" -ForegroundColor Green
        } else {
            Write-Host "✗ Frontend is not responding" -ForegroundColor Red
        }
    }
    "clean" {
        Write-Host "WARNING: This will remove all containers, volumes, and data!" -ForegroundColor Red
        $confirmation = Read-Host "Are you sure? (y/N)"
        if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
            Write-Host "Cleaning up Docker resources..." -ForegroundColor Yellow
            docker-compose down -v
            docker system prune -f
            Write-Host "Cleanup completed!" -ForegroundColor Green
        } else {
            Write-Host "Cleanup cancelled." -ForegroundColor Yellow
        }
    }
}

Write-Host "`nDone!" -ForegroundColor Green
