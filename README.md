# Local AI Command Center

A local-first, panel-driven control surface for AI operations, built with Next.js 15 and modern web technologies.

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd command-center
pnpm install

# Run preflight checks
pnpm run preflight

# Start development server
pnpm run dev
```

> **📖 Need detailed setup?** See our [comprehensive setup guide](docs/setup/local-development.md) for platform-specific instructions and troubleshooting.

## ✅ Prerequisites

- **Node.js** 20.0.0 or higher
- **pnpm** 9.0.0 or higher  
- **Ollama** for local AI model inference

### Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Windows 10/11 | ✅ Supported | PowerShell or WSL recommended |
| macOS 12+ | ✅ Supported | Native Terminal recommended |
| Linux (Ubuntu 20.04+) | ✅ Supported | Native Terminal recommended |

### Hardware Requirements

**Minimum:**
- 8GB RAM
- 2 CPU cores  
- 10GB free disk space

**Recommended:**
- 16GB+ RAM
- 4+ CPU cores
- 20GB+ free disk space (for models and data)

## 🏗️ Architecture

This project follows the canonical architecture:

- **Frontend**: Next.js 15 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js runtime with Route Handlers and Server Actions
- **Database**: SQLite + Drizzle ORM for transactional data
- **Vector Store**: LanceDB for RAG and embeddings
- **Runtime**: Ollama for local model inference
- **Streaming**: Server-Sent Events (SSE)

## ⚙️ Configuration

### Environment Variables

Create `.env.local` from [`.env.example`](.env.example):

```env
# Core Configuration
NODE_ENV=development
OLLAMA_BASE_URL=http://127.0.0.1:11434
DATABASE_URL=./data/command-center.db
LANCEDB_DIR=./data/lancedb
LOG_DIR=./data/logs

# Feature Flags  
ENABLE_RAG=true
ENABLE_AGENTS=false
ENABLE_MONITORING=true

# Development
ENABLE_DEVTOOLS=true
ENABLE_AUTH=false
```

### Common Configurations

**Development with local Ollama:**
```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
ENABLE_RAG=true
```

**Development with remote Ollama:**
```env
OLLAMA_BASE_URL=http://remote-server:11434
ENABLE_RAG=true
```

## 🛠️ Development Workflow

### Daily Development

1. **Start services:**
   ```bash
   # Terminal 1: Start Ollama
   ollama serve
   
   # Terminal 2: Start Command Center  
   pnpm run dev
   ```

2. **Make changes** - Hot reload enabled

3. **Run quality checks:**
   ```bash
   pnpm run lint          # ESLint
   pnpm run type-check    # TypeScript
   pnpm run test          # Unit tests
   pnpm run format:check  # Prettier
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
pnpm run db:generate    # Generate migrations
pnpm run db:migrate     # Run migrations  
pnpm run db:studio      # Open database UI
pnpm run db:seed        # Seed test data
pnpm run db:reset       # Reset database
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | TypeScript type checking |
| `pnpm test` | Run unit tests |
| `pnpm format` | Format code with Prettier |
| `pnpm preflight` | Run system health checks |
| `pnpm check-runtime` | Runtime diagnostics |

## 🐛 Troubleshooting

### Common Issues

#### "Node.js version too old"
```bash
# Install Node.js 20+ from https://nodejs.org/
# Or use a version manager:
nvm install 20 && nvm use 20
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
rm -rf .next/ *.tsbuildinfo

# Re-run type check
pnpm run type-check
```

### Getting Help

1. **Check logs** in `data/logs/` directory
2. **Run diagnostics:** `pnpm run check-runtime`
3. **Review configuration:** `pnpm run preflight`
4. **See detailed guide:** [Setup Documentation](docs/setup/local-development.md)
5. **Check GitHub Issues** for known problems
6. **Create an issue** with:
   - Operating system and version
   - Node.js and pnpm versions  
   - Error messages and logs
   - Steps to reproduce

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (command-center)/  # Route group for main UI
│   ├── api/               # API routes
│   └── globals.css
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   └── layout/           # Layout components
├── lib/                  # Core libraries
│   ├── config/           # Configuration
│   ├── db/               # Database setup
│   ├── runtime/          # Runtime adapters
│   └── utils/            # Utilities
└── types/                # TypeScript definitions
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run tests with coverage
pnpm test --coverage

# Run specific test file
pnpm test path/to/test.test.ts
```

## 📚 Documentation

- [Setup Guide](docs/setup/local-development.md) - Comprehensive setup instructions
- [Architecture Decision Records](docs/adr/) - Technical decisions and rationale
- [Conventions](docs/conventions.md) - Coding standards and practices
- [API Documentation](docs/api/) - API reference documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Run preflight checks: `pnpm run preflight`
4. Make changes and run tests: `pnpm test && pnpm run type-check`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**🎯 Next Steps:**
- Run `pnpm run preflight` to verify your setup
- Visit [Setup Guide](docs/setup/local-development.md) for detailed instructions
- Check [Architecture ADR](docs/adr/0001-canonical-architecture.md) for technical details

**💡 Need help?** See our [troubleshooting section](#-troubleshooting) or [open an issue](https://github.com/your-repo/issues).
