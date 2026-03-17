# Local Development Setup

This guide covers setting up the Command Center for local development.

## Prerequisites

### Required Software

- **Node.js** 20.0.0 or higher
- **pnpm** 9.0.0 or higher
- **Ollama** for local AI model inference

### Platform Support

| Platform              | Status       | Notes                         |
| --------------------- | ------------ | ----------------------------- |
| Windows 10/11         | ✅ Supported | PowerShell or WSL recommended |
| macOS 12+             | ✅ Supported | Native Terminal recommended   |
| Linux (Ubuntu 20.04+) | ✅ Supported | Native Terminal recommended   |

### Hardware Requirements

**Minimum:**

- 8GB RAM
- 2 CPU cores
- 10GB free disk space

**Recommended:**

- 16GB+ RAM
- 4+ CPU cores
- 20GB+ free disk space (for models and data)

## Installation Steps

### 1. Install Node.js and pnpm

```bash
# Install Node.js from https://nodejs.org/ or use a version manager
# Verify installation:
node --version  # Should be 20.x or higher

# Install pnpm
npm install -g pnpm@latest
pnpm --version  # Should be 9.x or higher
```

### 2. Install Ollama

**macOS/Linux:**

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows:**
Download and run the installer from https://ollama.com/download/windows

### 3. Clone and Setup Command Center

```bash
# Clone the repository
git clone <repository-url>
cd command-center

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Run preflight checks
pnpm run preflight
```

### 4. Start Ollama

```bash
# Start Ollama service
ollama serve

# In another terminal, verify it's working
curl http://localhost:11434/api/version

# Pull a model (optional, can be done via UI)
ollama pull llama2
```

### 5. Start Development Server

```bash
# Start the development server
pnpm run dev

# The application will be available at http://localhost:3000
```

## Configuration

### Environment Variables

Create `.env.local` with your configuration:

```env
# Core Configuration
NODE_ENV=development
PORT=3000
HOSTNAME=localhost

# Ollama Configuration
OLLAMA_BASE_URL=http://127.0.0.1:11434

# Database Configuration
DATABASE_URL=./data/command-center.db
LANCEDB_DIR=./data/lancedb

# Logging Configuration
LOG_DIR=./data/logs
LOG_LEVEL=info

# Feature Flags
ENABLE_RAG=true
ENABLE_AGENTS=false
ENABLE_MONITORING=true

# Development Options
ENABLE_DEVTOOLS=true
ENABLE_AUTH=false
```

### Common Configurations

**Development with local Ollama:**

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
ENABLE_RAG=true
ENABLE_AGENTS=false
```

**Development with remote Ollama:**

```env
OLLAMA_BASE_URL=http://remote-server:11434
ENABLE_RAG=true
ENABLE_AGENTS=false
```

**Testing configuration:**

```env
NODE_ENV=test
DATABASE_URL=:memory:
LANCEDB_DIR=./test-data/lancedb
LOG_DIR=./test-data/logs
```

## Development Workflow

### Daily Development

1. **Start services:**

   ```bash
   # Terminal 1: Start Ollama
   ollama serve

   # Terminal 2: Start Command Center
   pnpm run dev
   ```

2. **Make changes** - The development server will hot-reload

3. **Run tests:**

   ```bash
   pnpm run test
   ```

4. **Check types:**

   ```bash
   pnpm run type-check
   ```

5. **Format code:**
   ```bash
   pnpm run format
   ```

### Before Committing

```bash
# Run full check suite
pnpm run lint
pnpm run type-check
pnpm run test
pnpm run format:check
```

### Database Operations

```bash
# Generate database migrations
pnpm run db:generate

# Run migrations
pnpm run db:migrate

# Open database studio
pnpm run db:studio

# Seed with test data
pnpm run db:seed

# Reset database
pnpm run db:reset
```

## Troubleshooting

### Common Issues

#### "Node.js version too old"

```bash
# Install Node.js 20+ from https://nodejs.org/
# Or use a version manager like nvm:
nvm install 20
nvm use 20
```

#### "pnpm not found"

```bash
# Install pnpm globally
npm install -g pnpm@latest

# Or use Node's corepack:
corepack enable
corepack prepare pnpm@latest --activate
```

#### "Ollama connection failed"

```bash
# Check if Ollama is running
ollama list

# Start Ollama service
ollama serve

# Verify connectivity
curl http://localhost:11434/api/version
```

#### "Port 3000 already in use"

```bash
# Kill process on port 3000 (macOS/Linux)
lsof -ti:3000 | xargs kill

# Kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port
PORT=3001 pnpm run dev
```

#### "Database permission denied"

```bash
# Check directory permissions
ls -la data/

# Create directories with proper permissions
mkdir -p data logs
chmod 755 data logs
```

#### "TypeScript compilation errors"

```bash
# Clear TypeScript cache
rm -rf .next/
rm -f *.tsbuildinfo

# Re-run type check
pnpm run type-check
```

#### "Dependencies out of sync"

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
```

Add debug breakpoints in your code:

```typescript
console.log('Debug point:', { data })
```

Use Node.js inspector:

```bash
node --inspect-brk node_modules/.bin/next dev
```

### Performance Issues

#### Slow development server

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" pnpm run dev

# Use Turbopack (experimental)
NEXT_TURBOPACK=1 pnpm run dev
```

#### High memory usage

```bash
# Monitor memory usage
node --inspect scripts/memory-monitor.js

# Limit model loading
ENABLE_RAG=false
```

### Getting Help

1. **Check logs** in `data/logs/` directory
2. **Run diagnostics:**
   ```bash
   pnpm run check-runtime
   ```
3. **Review configuration:**
   ```bash
   pnpm run preflight
   ```
4. **Check GitHub Issues** for known problems
5. **Create an issue** with:
   - Operating system and version
   - Node.js and pnpm versions
   - Error messages and logs
   - Steps to reproduce

## Advanced Setup

### Using Docker

```dockerfile
# Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Create directories
RUN mkdir -p data logs

# Expose port
EXPOSE 3000

# Start development server
CMD ["pnpm", "run", "dev"]
```

```bash
# Build and run
docker build -f Dockerfile.dev -t command-center:dev .
docker run -p 3000:3000 -v $(pwd)/data:/app/data command-center:dev
```

### Multiple Environments

Create multiple environment files:

- `.env.development`
- `.env.staging`
- `.env.production`

Load specific environment:

```bash
NODE_ENV=staging pnpm run dev
```

### Custom Ollama Models

Add custom models to Ollama:

```bash
# Pull specific model
ollama pull codellama

# List available models
ollama list

# Use custom model file
ollama create mymodel -f ./Modelfile
```

---

This setup guide should get you running with Command Center for local development. If you encounter issues not covered here, please check the troubleshooting section or create an issue.
