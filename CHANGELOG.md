# Changelog

All notable changes to CodeAtlas are documented here.

## [1.2.1] - 2026-03-21

### Added
- **Panel toggle buttons** — hide/show left (AI Insights) and right (Entity Overview) panels
- Smooth slide animation with 0.3s transition
- Graph auto-expands to fill space when panels are hidden

---

## [1.2.0] - 2026-03-21

### Added
- **MCP Server** — AI assistants can query CodeAtlas analysis data via Model Context Protocol
  - `get_project_structure` — list all modules, classes, functions, variables
  - `get_dependencies` — import/call/containment relationships
  - `get_insights` — AI-generated code insights
  - `search_entities` — fuzzy search by entity name with relationships
  - `get_file_entities` — all entities in a specific file
- Extension now saves analysis to `.codeatlas/analysis.json` for MCP server
- `.gemini/settings.json` MCP config included

---

## [1.1.1] - 2026-03-21

### Added
- **`excludedFiles` setting** — skip generated stub files (e.g. `_ide_helper.php`)
- Default excludes: `_ide_helper.php`, `_ide_helper_models.php`, `.phpstorm.meta.php`

### Fixed
- Laravel `_ide_helper.php` (28k lines, 2072 method stubs) flooding the graph with framework functions

---

## [1.1.0] - 2026-03-21

### Added
- **PHP parser** — regex-based extraction of classes, interfaces, traits, enums, functions, properties, constants, namespaces, `use` statements
- **Blade template parser** — `@extends`, `@include`, `@component`, `<x-component>`, `@section`, `@yield`
- **Per-project config** — `codeatlas.fileExtensions` and `codeatlas.excludedDirectories` via `.vscode/settings.json`
- `.php` added to default `fileExtensions`
- `vendor`, `storage` added to default `excludedDirectories`
- Color coding: PHP `#4F5D95`, Blade `#FF2D20`, Interface `#7209b7`, Trait `#06d6a0`, Enum `#ffd166`

### Fixed
- **Webview race condition** — data sent before React mounted; added `webviewReady` handshake with message buffering
- **Blank webview** — moved `acquireVsCodeApi()` before React bundle; fixed CSS filename mismatch (`style.css` vs `index.css`)
- **JS error on load** — variable name collision (`el`) between inline script and Vite bundle
- **`graphPhysics` undefined** — replaced with default values
- **Phantom function nodes** — orphan links filtered from graph; `react-force-graph` no longer auto-creates nodes for undefined targets
- **CSS layout** — full rewrite: proper flexbox layout, left/right panels visible, graph centered, status bar flow-based

---

## [1.0.0] - 2026-03-21

### Added
- Interactive force-directed graph visualization of source code
- AST-based code analysis for TypeScript, JavaScript, and Python files
- AI Insights panel with refactoring suggestions, security audit, and maintainability score
- AI Copilot chat with natural language queries about codebase
- Entity overview sidebar with counts and relationship statistics
- Click-to-navigate from graph nodes to source code
- Auto-reanalyze on file save with debounce
- Graph search and entity type filtering
- VS Code status bar integration
- Custom dark cyberpunk theme with glassmorphism design