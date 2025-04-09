#!/bin/bash

cd "$(dirname "$0")/../.."

echo "=============================================="
echo "AI Outreach Email Template Generator Test Tool"
echo "=============================================="
echo

# Check if user ID was provided
userId="$1"
if [ -n "$userId" ]; then
  echo "Using user ID: $userId"
else
  echo "No user ID provided, using first available profile"
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed or not in PATH"
  echo "Please install Node.js from https://nodejs.org/"
  exit 1
fi

# Run the test script
echo "Running test script to generate email templates..."
echo
node -r dotenv/config tests/outreach/test-templates.js "$userId"

echo
echo "=============================================="
echo "Testing completed!"
echo
echo "Templates have been saved to the tests/outreach/results folder."
echo "Opening the folder now..."
echo

# Open the output directory
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  open tests/outreach/results
elif [[ -n $(command -v xdg-open) ]]; then
  # Linux with xdg-open
  xdg-open tests/outreach/results
else
  # Fallback
  echo "Please check the templates in the tests/outreach/results directory."
fi

echo "Press Enter to exit..."
read 