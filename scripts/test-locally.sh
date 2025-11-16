#!/bin/bash
# Quick local test runner that validates all 5 security claims

set -e

echo "================================================"
echo "Local Security Test Runner"
echo "================================================"
echo ""
echo "Platform: $(uname -s)"
echo "Date: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

    # Check platform-specific sandbox tool
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if ! command -v bwrap &> /dev/null; then
            echo -e "${RED}✗ bubblewrap is not installed${NC}"
            echo -e "${YELLOW}  Install with: sudo apt-get install bubblewrap${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ bubblewrap found${NC}"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        if ! command -v sandbox-exec &> /dev/null; then
            echo -e "${RED}✗ sandbox-exec is not available${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ sandbox-exec found${NC}"
    else
        echo -e "${RED}✗ Unsupported platform: $OSTYPE${NC}"
        exit 1
    fi

    echo ""
}

# Setup test environment
setup_test_environment() {
    echo "Setting up test environment..."

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi

    # Build if needed
    if [ ! -d "dist" ]; then
        echo "Building project..."
        npm run build
    fi

    # Create test files
    mkdir -p ~/.ssh
    if [ ! -f ~/.ssh/id_rsa ]; then
        echo "DUMMY_SSH_KEY" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
    fi

    mkdir -p ~/.aws
    if [ ! -f ~/.aws/credentials ]; then
        cat > ~/.aws/credentials << EOF
[default]
aws_access_key_id = DUMMY_KEY
aws_secret_access_key = DUMMY_SECRET
EOF
        chmod 600 ~/.aws/credentials
    fi

    echo -e "${GREEN}✓ Test environment ready${NC}"
    echo ""
}

# Run the tests
run_tests() {
    echo "Running security validation tests..."
    echo ""
    echo "This will verify:"
    echo "  1. SSH key access is blocked"
    echo "  2. AWS credentials access is blocked"
    echo "  3. Writing outside working directory is blocked"
    echo "  4. Working directory access is allowed"
    echo "  5. System file access is blocked"
    echo "  BONUS: Subprocess isolation works"
    echo ""

    npm test -- src/__tests__/security-validation.test.ts --reporter=verbose

    local exit_code=$?
    echo ""

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}================================================${NC}"
        echo -e "${GREEN}✓ ALL SECURITY TESTS PASSED${NC}"
        echo -e "${GREEN}================================================${NC}"
        echo ""
        echo "All security claims have been validated:"
        echo "  ✅ SSH keys are protected"
        echo "  ✅ AWS credentials are protected"
        echo "  ✅ Filesystem is isolated to working directory"
        echo "  ✅ System files are protected"
        echo "  ✅ Subprocesses are also sandboxed"
    else
        echo -e "${RED}================================================${NC}"
        echo -e "${RED}✗ SOME TESTS FAILED${NC}"
        echo -e "${RED}================================================${NC}"
        exit $exit_code
    fi
}

# Main execution
main() {
    check_prerequisites
    setup_test_environment
    run_tests
}

main
