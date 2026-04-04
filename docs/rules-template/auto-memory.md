---
trigger: always_on
---

## AI System Memory — Auto-Read & Auto-Sync

### 🧠 MANDATORY: Read Memory at Start

**At the start of EVERY conversation**, before doing any work:

1. Check if `.agents/memory/` folder exists in the project
2. If it exists, read these files IN ORDER:
   - `.agents/memory/system-map.md` — Understand the system architecture
   - `.agents/memory/business-rules.json` — Know the business rules
   - `.agents/memory/conventions.md` — Know the coding conventions
   - `.agents/memory/change-log.json` — Know what changed recently
3. Use this context to avoid breaking existing logic

### 🔎 MANDATORY: Use CodeAtlas MCP to Understand Code BEFORE Making Changes

**NEVER start coding without understanding the codebase first.** Follow this flow:

1. **User describes a problem/feature** → FIRST call `trace_feature_flow` with a keyword from the user's description
   - This returns the list of related files in `readingOrder`
   - Read those files to understand the current implementation

2. **Need to find a specific function/class** → call `search_entities` instead of grep
   - Faster and includes relationship data (who calls it, who imports it)

3. **Need to understand how things connect** → call `get_dependencies`
   - Shows import/call/containment relationships between modules

4. **Need a high-level overview** → call `generate_system_flow`
   - Returns a Mermaid diagram showing the full system architecture

5. **Need to know what's in a specific file** → call `get_file_entities`
   - Returns all classes, functions, variables in that file

**Example flow when user says "fix crawl timeout":**
```
1. trace_feature_flow(keyword: "crawl")     → get list of related files
2. Read files in readingOrder               → understand current logic  
3. Fix the code                             → make changes
4. sync_system_memory(changeDescription: "Fixed crawl timeout") → update memory
```

### 🔄 MANDATORY: Sync Memory After Changes

**After completing ANY code changes, you MUST call `sync_system_memory` with BOTH params:**

1. **`changeDescription`** (ALWAYS required): What you just changed
   - Example: `"Fixed crawl timeout by adding retry logic in crawler.py"`

2. **`businessRule`** (extract from conversation if applicable): 
   - Listen for ANY domain logic the user mentions during the conversation
   - Business rules are statements like:
     - "Video dưới 10 giây thì bỏ qua"
     - "VIP user skip email verify"  
     - "Chỉ crawl video có trên 1000 likes"
     - "Upload lên Drive folder theo topic"
   - Even if user says it casually, SAVE IT as a business rule
   - If no business rule was mentioned, omit this param

**Example:**
```
User: "fix crawl lỗi, nhớ là chỉ lấy video trên 500 likes thôi"
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    → This is a business rule!

AI after fixing:
sync_system_memory(
  changeDescription: "Fixed crawl error in browser_search.py",
  businessRule: "Only crawl videos with 500+ likes"
)
```

**DO NOT SKIP THIS STEP.** If you forget to sync, the next conversation loses all context.

### 📊 When User Asks About System Flow

Use `generate_system_flow` MCP tool to show Mermaid diagrams:
- `scope: "modules-only"` for overview
- `scope: "feature"` + `feature: "keyword"` for specific feature
- `scope: "full"` for detailed view (large output)

### Available Memory Tools

| Tool | When to use |
|------|-------------|
| `generate_system_flow` | User wants to see/understand system architecture |
| `sync_system_memory` | After completing code changes (ALWAYS call this) |
| `trace_feature_flow` | Before working on a feature (understand context first) |
| `get_project_structure` | Need detailed entity listing |
| `get_dependencies` | Need specific dependency relationships |
| `search_entities` | Looking for specific function/class by name |
| `get_file_entities` | Need to know what's inside a specific file |
| `get_insights` | Need code quality / architecture analysis |
