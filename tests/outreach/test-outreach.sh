#!/bin/bash

echo "=============================================="
echo "AI Outreach Email Template Generator Test Tool"
echo "=============================================="
echo

# Create the output directory if it doesn't exist
mkdir -p outreach-templates

# Check if node is installed
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed or not in PATH"
  echo "Please install Node.js from https://nodejs.org/"
  exit 1
fi

# Run the test script
echo "Running test script to generate email templates..."
echo
node -r dotenv/config src/test-outreach-templates.js

echo
echo "=============================================="
echo "Testing completed!"
echo
echo "Templates have been saved to the outreach-templates folder."
echo "Opening the folder now..."
echo

# Open the output directory (works on Mac and most Linux distros)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  open outreach-templates
elif [[ -n $(command -v xdg-open) ]]; then
  # Linux with xdg-open
  xdg-open outreach-templates
else
  # Fallback
  echo "Please check the templates in the outreach-templates directory."
fi

echo "Press Enter to exit..."
read 