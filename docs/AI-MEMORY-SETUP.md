# 🧠 AI System Memory — Setup Guide

## Cái này là gì?

Giải quyết vấn đề **AI quên context giữa các conversation**. Khi bạn mở chat mới, AI tự biết:
- Hệ thống có những module nào, kết nối ra sao
- Business rules hiện tại
- Code conventions
- Gần đây sửa gì

## Yêu cầu

1. **CodeAtlas MCP server** đã cài và chạy ([xem hướng dẫn](#cài-codeatlas-mcp))
2. Project đã chạy `CodeAtlas: Analyze Project` trong VS Code ít nhất 1 lần

## Setup cho project mới

### Bước 1: Copy rule files

```bash
# Thay YOUR_PROJECT bằng đường dẫn project của bạn
mkdir -p /path/to/YOUR_PROJECT/.agents/rules/

# Copy 2 rule files
cp /home/biibon/CodeAtlas/docs/rules-template/auto-memory.md /path/to/YOUR_PROJECT/.agents/rules/
cp /home/biibon/CodeAtlas/docs/rules-template/codeatlas-mcp.md /path/to/YOUR_PROJECT/.agents/rules/
```

Hoặc copy nhanh tất cả:
```bash
cp /home/biibon/CodeAtlas/docs/rules-template/*.md /path/to/YOUR_PROJECT/.agents/rules/
```

**2 files được copy:**
| File | Chức năng |
|------|-----------|
| `auto-memory.md` | Bắt AI đọc memory đầu conversation, sync sau khi sửa code |
| `codeatlas-mcp.md` | Bắt AI dùng CodeAtlas MCP tools thay vì grep thủ công |

### Bước 2: Chạy Analyze Project

Mở project trong VS Code → `Ctrl+Shift+P` → `CodeAtlas: Analyze Project`

Việc này tạo file `.codeatlas/analysis.json` — dữ liệu để MCP tools đọc.

### Bước 3: Sync Memory lần đầu

Trong Gemini CLI hoặc editor AI, gọi:

```
Hãy gọi sync_system_memory cho project này
```

AI sẽ tạo folder `.agents/memory/` với 6 files:

```
.agents/memory/
├── system-map.md          # Sơ đồ Mermaid tổng quan (auto-generated)
├── modules.json           # Danh sách modules + imports + contains
├── feature-flows.json     # Feature → files mapping
├── business-rules.json    # Business rules bạn mô tả
├── change-log.json        # Lịch sử thay đổi gần đây
└── conventions.md         # Languages, patterns, structure
```

### Bước 4: Xong!

Từ giờ mọi conversation mới, AI sẽ:
1. Đọc `.agents/memory/` → biết flow hệ thống
2. Dùng MCP trace code → hiểu trước khi sửa
3. Sync memory sau khi sửa → conversation sau nhớ

---

## Cài CodeAtlas MCP

### Gemini CLI / Antigravity

Thêm vào `.gemini/settings.json` của project:

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "npx",
      "args": ["tsx", "/home/biibon/CodeAtlas/index.ts"]
    }
  }
}
```

### Cursor

Thêm vào `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "codeatlas": {
      "command": "npx",
      "args": ["tsx", "/home/biibon/CodeAtlas/index.ts"]
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add codeatlas -- npx tsx /home/biibon/CodeAtlas/index.ts
```

---

## MCP Tools có sẵn

| Tool | Khi nào dùng |
|------|-------------|
| `generate_system_flow` | Xem sơ đồ kiến trúc hệ thống (Mermaid) |
| `sync_system_memory` | Sau khi sửa code (BẮT BUỘC gọi) |
| `trace_feature_flow` | Trước khi sửa feature (hiểu context) |
| `get_project_structure` | Xem danh sách modules, classes, functions |
| `get_dependencies` | Xem quan hệ import/call giữa modules |
| `search_entities` | Tìm function/class theo tên |
| `get_file_entities` | Xem tất cả entities trong 1 file |
| `get_insights` | Phân tích code quality |
| `list_projects` | Liệt kê tất cả projects đã analyze |

## Luồng fix problem

```
Bạn: "feature X bị lỗi Y"
          │
          ▼
AI đọc .agents/memory/     ← nhớ lại flow hệ thống
          │
          ▼
AI gọi trace_feature_flow("X")  ← tìm files liên quan
          │
          ▼
AI đọc files theo readingOrder   ← hiểu code hiện tại
          │
          ▼
AI fix code                      ← sửa đúng chỗ
          │
          ▼
AI gọi sync_system_memory()     ← cập nhật memory cho lần sau
```

## FAQ

**Q: Memory bị cũ khi code thay đổi?**
A: Không. Rule bắt AI gọi `sync_system_memory` sau mỗi lần sửa code. Memory luôn được cập nhật từ code thực tế.

**Q: Business rules thay đổi thì sao?**
A: Khi bạn mô tả rule mới, AI tự lưu vào `business-rules.json`. File này chỉ append, không bao giờ xóa.

**Q: Project mới chưa có analysis.json?**
A: Chạy `CodeAtlas: Analyze Project` trong VS Code trước. Sau đó MCP tools mới hoạt động.

**Q: Dùng được với ngôn ngữ nào?**
A: TypeScript, JavaScript, Python, PHP (bao gồm Blade templates).
