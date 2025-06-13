@echo off
echo ========================================
echo Kolocollect Contribution History Fix Tool
echo ========================================
echo.

echo Checking connection to MongoDB...
node -e "require('./config'); console.log('MongoDB connection settings loaded successfully')"
if %ERRORLEVEL% NEQ 0 (
    echo Error: Failed to load MongoDB connection settings
    exit /b 1
)

echo.
echo Step 1: Debugging Midcycle History
echo -----------------------------------
echo This will analyze the structure of cycles and midcycles
echo to identify any issues with the history display.
echo.
set /p communityId=Enter community ID to analyze: 

if "%communityId%"=="" (
    echo Error: Community ID is required
    exit /b 1
)

echo.
echo Analyzing community %communityId%...
echo.

node debug-midcycle-history.js %communityId%

echo.
echo Step 2: Would you like to fix the issues detected? (y/n)
set /p fix=

if /i "%fix%"=="y" (
    echo.
    echo Running fix script...
    node debug-midcycle-history.js %communityId% --fix

    echo.
    echo Fix completed. Verifying results...
    node debug-midcycle-history.js %communityId%
)

echo.
echo Step 3: Fix All Communities
echo --------------------------
echo This will apply the same fixes to all communities.
echo.
echo Would you like to fix all communities? (y/n)
set /p fixAll=

if /i "%fixAll%"=="y" (
    echo.
    echo Running fix script for all communities...
    node fix-contribution-history.js

    echo.
    echo Fix completed for all communities.
)

echo.
echo ========================================
echo Fix process complete
echo ========================================
echo.
echo The next steps are:
echo 1. Restart your backend server
echo 2. Clear browser cache or use incognito mode
echo 3. Test the contribution history display
echo.
echo If issues persist, contact support for further assistance.
