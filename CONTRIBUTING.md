# Contributing to Frigate-SimpleUI

Thanks for your interest in contributing. This document explains how to set up your dev environment, run checks, and open a pull request.

## Development setup

### Prerequisites

- **Node.js** >= 14.x and **npm** >= 6.x
- A running **Frigate** instance (optional for UI work; needed for full integration testing)
- **ffmpeg** on the machine running the app (for stream testing and snapshots)

### Install and run

```bash
git clone https://github.com/lich2000117/Frigate-SimpleUI.git
cd Frigate-SimpleUI
cp .env.example .env
# Edit .env and set FRIGATESIMPLEUI_URL and GO2RTC_URL to your Frigate instance (or leave defaults for UI-only work)

npm run install:all
npm run dev
```

- **Client**: http://localhost:3000 (React dev server, proxies API to 3001)
- **Server**: http://localhost:3001 (Express API)

The client uses `nodemon` for the server and Create React App for the client, so both reload on file changes.

## Running checks

| Command | Description |
|--------|-------------|
| `npm run install:all` | Install root + client dependencies |
| `npm run build` | Build the React client (runs ESLint via react-scripts) |
| `npm run dev` | Start server + client in development mode |
| `npm start` | Production: serve built client + API from server |
| `npm test` | Run tests (root; add client tests with `cd client && npm test`) |

There is no separate lint script at the repo root. The client runs ESLint as part of `npm run build` (Create React App). Please ensure `npm run build` passes before opening a PR.

## Pull request process

1. **Fork** the repo and create a branch from `main`:
   ```bash
   git checkout -b feature/short-description
   # or
   git checkout -b fix/short-description
   ```

2. **Make your changes** and test locally:
   - Run `npm run install:all` and `npm run build` to confirm the project builds.
   - Manually test the flows you changed (dashboard, add/edit camera, scan, save config).

3. **Commit** with a clear message:
   - Use present tense ("Add X" not "Added X").
   - Reference an issue number if applicable, e.g. `Fix camera name validation (#42)`.

4. **Push** your branch and open a **Pull Request** against `main`:
   - Fill in the PR template (what changed, how to test).
   - Keep the PR focused; prefer several small PRs over one large one.

5. **Review**: Maintainers may ask for changes. Once approved, a maintainer will merge.

## Code and PR guidelines

- **Camera names**: Alphanumeric and underscores only, max 32 characters (enforced by the app).
- **Config**: Camera and detector state lives in server memory; restart the server to reload from Frigate.
- **API**: See [README – API Reference](README.md#api-reference) for endpoints and behavior.
- **License**: By contributing, you agree that your contributions will be licensed under the project’s MIT License.

## Questions or ideas

- **Bugs and features**: Open an [issue](https://github.com/lich2000117/Frigate-SimpleUI/issues) (use the templates when possible).
- **Ideas**: Check the [README – Ideas for contributions](README.md#ideas-for-contributions) for suggested areas (Docker, tests, i18n, etc.).

Thank you for contributing.
