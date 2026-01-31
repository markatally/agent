#!/bin/bash

# Manus Agent - Docker CE (Colima) Setup Script for macOS

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo -e "${RED}Homebrew is required but not installed.${NC}"
    echo -e "${YELLOW}Install Homebrew:${NC}"
    echo -e '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    exit 1
fi

print_section "Installing Docker CE (Colima) on macOS"

# Install Colima
if command -v colima &> /dev/null; then
    print_success "Colima is already installed"
else
    print_info "Installing Colima..."
    brew install colima docker docker-compose
    print_success "Colima installed"
fi

# Start Colima
print_section "Starting Colima"

if colima status &> /dev/null; then
    print_success "Colima is already running"
    print_info "Status:"
    colima status
else
    print_info "Starting Colima (this may take a minute)..."
    colima start --cpu 2 --memory 4 --disk 60
    print_success "Colima started"
fi

# Verify Docker is working
print_section "Verifying Docker Installation"

docker version --format 'Docker: {{.Server.Version}}' 2>/dev/null && \
    print_success "Docker is working" || \
    (echo -e "${RED}Docker not responding${NC}" && exit 1)

docker-compose version --short &>/dev/null && \
    print_success "Docker Compose is working" || \
    (echo -e "${RED}Docker Compose not responding${NC}" && exit 1)

# Pull required images
print_section "Pulling Docker Images"

print_info "Pulling postgres:16-alpine..."
docker pull postgres:16-alpine
print_success "PostgreSQL image pulled"

print_info "Pulling redis:7-alpine..."
docker pull redis:7-alpine
print_success "Redis image pulled"

# Start infrastructure
print_section "Starting Infrastructure"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

docker-compose up -d db redis

# Wait for PostgreSQL
print_info "Waiting for PostgreSQL..."
for i in {1..30}; do
    if docker-compose exec -T db pg_isready -U manus &> /dev/null; then
        print_success "PostgreSQL is ready"
        break
    fi
    sleep 1
done

# Wait for Redis
print_info "Waiting for Redis..."
for i in {1..30}; do
    if docker-compose exec -T redis redis-cli ping &> /dev/null; then
        print_success "Redis is ready"
        break
    fi
    sleep 1
done

print_section "Setup Complete!"

echo -e "${GREEN}Services:${NC}"
echo -e "  • Colima/Docker CE: ${BLUE}Running${NC}"
echo -e "  • PostgreSQL: ${BLUE}localhost:5432${NC}"
echo -e "  • Redis: ${BLUE}localhost:6379${NC}"

echo -e "\n${GREEN}Colima Commands:${NC}"
echo -e "  • Start: ${BLUE}colima start${NC}"
echo -e "  • Stop: ${BLUE}colima stop${NC}"
echo -e "  • Status: ${BLUE}colima status${NC}"
echo -e "  • Reset: ${BLUE}colima delete --force && colima start${NC}"

echo -e "\n${GREEN}Docker Commands:${NC}"
echo -e "  • View logs: ${BLUE}docker-compose logs -f${NC}"
echo -e "  • Stop services: ${BLUE}docker-compose down${NC}"

echo -e "\n${GREEN}Next:${NC} Run ${BLUE}./scripts/init-env.sh${NC} to complete setup"
