#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Hardcoded variables (Update these values)
BUCKET_NAME="your-s3-bucket-name"
S3_KEY="path/to/upload/installer.exe"

# Get the directory of the current script (which is now install-wizard)
WIZARD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$WIZARD_DIR"

DIST_DIR="${WIZARD_DIR}/dist"
if [ ! -d "$DIST_DIR" ]; then
    echo "Error: Build output directory not found at $DIST_DIR. Build might have failed or electron-builder is configured differently."
    exit 1
fi

# Find the most recently modified .exe file in the dist directory
INSTALLER_FILE=$(ls -t "$DIST_DIR"/*.exe 2>/dev/null | head -n 1)

if [ -z "$INSTALLER_FILE" ]; then
    echo "Error: Could not find an .exe file in $DIST_DIR. Build may have failed."
    exit 1
fi

S3_URI="s3://${BUCKET_NAME}/${S3_KEY}"

echo "Found installer at: $INSTALLER_FILE"
echo "Deploying to $S3_URI ..."

aws s3 cp "$INSTALLER_FILE" "$S3_URI"

echo "Deployment completed successfully!"
