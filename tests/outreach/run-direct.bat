@echo off
echo ===================================================
echo AI Outreach Email Template Generator - Direct Test
echo ===================================================
echo.

:: Change to project root directory
cd %~dp0\..\..

:: Run the test using Next.js environment (handles TypeScript automatically)
echo Running test script with Next.js...
echo.
npx next exec tests/outreach/test-direct.ts

echo.
echo ===================================================
echo Test completed!
echo.
echo Templates should be saved in tests/outreach/results
echo.

:: Open the results folder
if exist tests\outreach\results start "" "tests\outreach\results"

echo Press any key to exit...
pause >nul 