@echo off
setlocal

echo ==============================================
echo AI Outreach Email Template Generator Test Tool
echo ==============================================
echo.

cd %~dp0\..\..

:: Check if user ID was provided
set "userId=%~1"
if not "%userId%"=="" (
  echo Using user ID: %userId%
) else (
  echo No user ID provided, using first available profile
)

:: Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo ERROR: Node.js is not installed or not in PATH
  echo Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

:: Run the test script
echo Running test script to generate email templates...
echo.
node -r dotenv/config tests/outreach/test-templates.js %userId%

echo.
echo ==============================================
echo Testing completed!
echo.
echo Templates have been saved to the tests/outreach/results folder.
echo Opening the folder now...
echo.

:: Open the output directory
start "" "tests\outreach\results"

echo Press any key to exit...
pause >nul
endlocal 