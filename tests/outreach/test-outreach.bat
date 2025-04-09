@echo off
echo ==============================================
echo AI Outreach Email Template Generator Test Tool
echo ==============================================
echo.

:: Create the output directory if it doesn't exist
if not exist "outreach-templates" mkdir "outreach-templates"

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
node -r dotenv/config src/test-outreach-templates.js

echo.
echo ==============================================
echo Testing completed!
echo.
echo Templates have been saved to the outreach-templates folder.
echo Opening the folder now...
echo.

:: Open the output directory
start "" "outreach-templates"

echo Press any key to exit...
pause >nul 