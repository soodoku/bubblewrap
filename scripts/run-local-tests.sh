#!/bin/bash
# Run local security validation tests and document results

set -e

echo "========================================="
echo "Local Security Validation Tests"
echo "========================================="
echo ""
echo "Platform: $(uname -s)"
echo "Date: $(date)"
echo ""

# Ensure we have necessary files for testing
setup_test_files() {
    echo "Setting up test environment..."

    # Create .ssh directory if it doesn't exist (for testing)
    mkdir -p ~/.ssh

    # Create dummy SSH key if it doesn't exist (for testing)
    if [ ! -f ~/.ssh/id_rsa ]; then
        echo "Creating dummy SSH key for testing..."
        echo "DUMMY_SSH_KEY" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
    fi

    # Create .aws directory if it doesn't exist (for testing)
    mkdir -p ~/.aws

    # Create dummy AWS credentials if they don't exist (for testing)
    if [ ! -f ~/.aws/credentials ]; then
        echo "Creating dummy AWS credentials for testing..."
        cat > ~/.aws/credentials << EOF
[default]
aws_access_key_id = DUMMY_KEY
aws_secret_access_key = DUMMY_SECRET
EOF
        chmod 600 ~/.aws/credentials
    fi

    echo "✓ Test environment ready"
    echo ""
}

# Run the tests
run_tests() {
    echo "Running security validation tests..."
    echo ""

    npm test -- src/__tests__/security-validation.test.ts
}

# Main execution
main() {
    setup_test_files
    run_tests
}

main
