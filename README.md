<div align="center">

# Pall AgentX

**Autonomous Intelligence Interface**

*Engineered for precision. Designed for elegance.*

---

</div>

## Overview

**Pall AgentX** is a premium, luxury-grade autonomous AI chat interface built with a "Luxury Noir" design language. It features a stunning black-and-gold aesthetic, responsive multi-device layout, voice recognition, and intelligent URL parsing — all deployed as a serverless application on Cloudflare Pages.

## Architecture

```
Pall AgentX/
|-- .vscode/
|   +-- extensions.json          # IDE extension recommendations
|-- functions/
|   +-- chat.js                  # Cloudflare Pages serverless backend
|-- public/
|   +-- assets/                  # Static assets (images, fonts, icons)
|-- src/
|   |-- index.html               # Main UI entry point
|   |-- styles/
|   |   +-- main.css             # Luxury Noir design system + responsive
|   +-- utils/
|       +-- script.js            # Frontend logic + Voice Recognition
|-- .env                         # Environment variables (local only)
|-- .gitignore                   # Git ignore rules
+-- README.md                    # This file
```

## Features

### Design
- **Luxury Noir** theme with pure black (#000000) base and elegant gold (#C9A84C) accents
- **Cinzel** display typography + **Inter** body typography
- Ambient particle canvas with gold-tinted connections
- Premium micro-animations (fade-in, pulse, loading dots)
- Zero emojis — purely typographic and iconographic

### Responsive Layout
| Viewport | Layout |
|----------|--------|
| Desktop (1024px+) | Split-screen: visual panel (left) + chat terminal (right) |
| Tablet (768px-1024px) | Condensed split-screen with smaller visual panel |
| Mobile (< 768px) | Stacked: minimal brand header + full-screen chat |
| Mobile Landscape | Visual panel hidden, full chat |

### Intelligence
- **AI Backend**: Powered by DeepSeek R1 via OpenRouter API
- **URL Scraping**: Automatic detection and content extraction from user-provided links
- **Identity Lock**: Hardened system prompt preventing model identity leakage
- **Thinking Tag Cleanup**: Strips `<think>` tags from R1 responses

### Interaction
- **Voice Input**: Web Speech API integration with animated microphone pulse
- **Auto-growing textarea**: Input area expands with content
- **Keyboard shortcuts**: Enter to send, Shift+Enter for newline
- **Conversation clear**: One-click conversation reset

## Deployment

### Prerequisites
- Cloudflare account with Pages enabled
- OpenRouter API key

### Deploy to Cloudflare Pages

1. **Push to GitHub/GitLab**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Pall AgentX v1.0"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Connect to Cloudflare Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > Pages
   - Create a new project and connect your repository
   - Configure build settings:
     - **Build command**: *(leave empty — no build step needed)*
     - **Build output directory**: `src`
     - **Root directory**: `/`

3. **Set Environment Variables**
   - In Cloudflare Pages > Settings > Environment Variables
   - Add: `OPENROUTER_API_KEY` = `your-api-key-here`

4. **Deploy**
   - Cloudflare will automatically deploy on push

### Local Development

For local testing with Cloudflare Wrangler:

```bash
npm install -g wrangler
wrangler pages dev src --binding OPENROUTER_API_KEY=your-key-here
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key for AI model access | Yes |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5, CSS3, JavaScript (ES2020+) |
| Backend | Cloudflare Pages Functions (Serverless) |
| AI Model | DeepSeek R1 via OpenRouter |
| Hosting | Cloudflare Pages (Edge Network) |
| Voice | Web Speech API (SpeechRecognition) |
| Typography | Google Fonts (Cinzel, Inter) |

## Security

- API keys stored exclusively in environment variables
- No client-side API key exposure
- CORS headers configured for API endpoint
- System prompt identity lock prevents model information disclosure
- `.env` excluded from version control via `.gitignore`

---

<div align="center">

**Pall AgentX v1.0**

Crafted by Developer Pall | [@p4llaje](https://instagram.com/p4llaje)

</div>
