# Backend Handoff — Warehouse Inventory App

**App:** Warehouse Inventory Map v3.7  
**Current state:** 100% client-side React, state persisted to `localStorage`  
**Goal:** Replace localStorage with a real backend so data persists across devices/sessions and multiple users can work simultaneously.

---

## 1. What the App Does

A 16×16 grid map of a physical warehouse. Each cell can hold up to 3 stacked pallets (A/B/C). Workers add, edit, and remove pallets; the grid shows where every pallet is. Key workflows:

- Tap a grid cell → select it → add/view/edit/delete pallets in that cell
- Mark pallets Active or Old/Bad (flags damaged/expired inventory)
- Search and filter by pallet number, lot, blend, or tag
- Export inventory to CSV or JSON; import from JSON backup
- Undo the last N operations (currently up to 50 steps, client-side)

---

## 2. Data Model

### Pallet

All data lives in a single flat collection of pallets. No other entities currently exist.

| Field          | Type     | Constraints                              | Notes                                                              |
|----------------|----------|------------------------------------------|--------------------------------------------------------------------|
| `id`           | string   | unique, primary key                      | Client generates `p_{timestamp}_{random}`; backend should own this |
| `number`       | integer  | ≥ 0                                      | Display number; reassigned on renumber                             |
| `row`          | integer  | 0–15                                     | 0-based grid row                                                   |
| `col`          | integer  | 0–15                                     | 0-based grid column                                                |
| `stack_label`  | enum     | `A` \| `B` \| `C`                        | Position within a stacked cell                                     |
| `lot`          | string   | optional                                 | Lot/batch number, e.g. `MR-2024-041`                               |
| `blend`        | string   | optional                                 | Product name, e.g. `Milk Replacer` or `Eliminator (25#)`           |
| `quantity`     | integer  | ≥ 0                                      | Count of bags, buckets, etc.                                       |
| `units`        | enum     | `bags` \| `buckets` \| `lbs` \| `kg` \| `tons` |                                                               |
| `stack_height` | integer  | 1–3                                      | Physical pallet layers in the stack                                |
| `status`       | enum     | `active` \| `old_bad`                    | `old_bad` = damaged / expired                                      |
| `tag`          | string   | optional                                 | Free-form label, e.g. `PRIORITY`, `HOLD`, `DAMAGED`               |
| `notes`        | string   | optional                                 | Free-text notes                                                    |

### Business Constraints (enforce server-side)

- A `(row, col)` cell may contain at most **3 pallets**.
- Within a cell, `stack_label` values must be unique (`A`, `B`, `C` — one per slot).
- `row` 0, columns 7–8 = **West door** (no pallets allowed).
- `row` 15, columns 7–8 = **East door** (no pallets allowed).
- `number` is a display integer reassigned on "Renumber All"; it is **not** a stable identifier.

---

## 3. Required API Endpoints

Recommended base path: `/api/v1`

### Pallets

| Method   | Path                          | Description                                      |
|----------|-------------------------------|--------------------------------------------------|
| `GET`    | `/pallets`                    | List all pallets. Supports `?status=`, `?q=`     |
| `POST`   | `/pallets`                    | Create one pallet                                |
| `PATCH`  | `/pallets/:id`                | Update fields on one pallet                      |
| `DELETE` | `/pallets/:id`                | Delete one pallet                                |
| `DELETE` | `/pallets?row={r}&col={c}`    | Delete all pallets in a cell                     |
| `POST`   | `/pallets/renumber`           | Renumber all pallets in reading order (top→bottom, left→right, A→C) |
| `DELETE` | `/pallets`                    | Delete all pallets (clear warehouse)             |

### Import / Export

| Method | Path                    | Description                                         |
|--------|-------------------------|-----------------------------------------------------|
| `GET`  | `/export/csv`           | Return CSV file (same column order as current app)  |
| `GET`  | `/export/json`          | Return JSON backup `{ version, exportDate, gridRows, gridCols, pallets }` |
| `GET`  | `/export/pdf`           | Generate and return PDF (currently stubbed in UI)   |
| `POST` | `/import/json`          | Accept JSON backup body, replace all pallets        |

### GET /pallets — Query Params

| Param    | Values                  | Description                                |
|----------|-------------------------|--------------------------------------------|
| `status` | `active` \| `old_bad`  | Filter by status                           |
| `q`      | string                  | Search pallet number, lot, blend, tag, notes |

### Response Shape

All pallets endpoints return pallet objects matching the schema in §2. List endpoint returns an array:

```json
[
  {
    "id": "p_1234567890_0.123",
    "number": 1,
    "row": 1,
    "col": 0,
    "stack_label": "A",
    "lot": "MR-2024-041",
    "blend": "Milk Replacer",
    "quantity": 48,
    "units": "bags",
    "stack_height": 2,
    "status": "active",
    "tag": "",
    "notes": ""
  }
]
```

Error responses should use standard HTTP status codes with a JSON body:

```json
{ "error": "Cell is full (max 3 pallets)" }
```

---

## 4. CSV Export Column Order

The existing CSV export produces columns in this order — preserve it for compatibility with any existing spreadsheet workflows:

```
Cell ID, Pallet #, Stack Label, Product / Blend, Lot #, Qty, Units, Stack Height, Status, Tag, Notes, Row (1-based), Col (1-based)
```

- **Cell ID** format: `R01C01` (row and col are 1-based, zero-padded to 2 digits)
- **Status** displayed as `Active` or `OLD/BAD` (not the raw enum value)
- **Pallet #** displayed as `{number}{stack_label}` when multiple pallets share a cell, otherwise just `{number}`

---

## 5. JSON Import/Export Format

```json
{
  "version": "3.7",
  "exportDate": "2024-01-15T12:00:00.000Z",
  "gridRows": 16,
  "gridCols": 16,
  "pallets": [ /* array of pallet objects */ ]
}
```

Import replaces all existing pallets atomically. Validate each pallet through the same rules in §2 before committing.

---

## 6. Product Catalog (Reference)

The UI hardcodes these product names. The backend can store `blend` as a free string; no FK to a products table is required at this stage. Document here for context:

**Bag products:**
- Milk Replacer
- Magnum Milk Replacer

**Bucket products** (stored as `{Product} ({Weight})`):
- Eliminator — 10#, 25#, 50#
- First Aid — 10#, 25#, 50#
- Gold Medal — 10#, 25#, 50#
- HPVM — 10#, 25#, 50#
- Immunizer — 10#, 25#, 44#, 50#
- Magnum Calf Aide — 10#, 25#, 50#
- Magnum-Lac — 10#, 25#, 50#
- RFA — 10#, 25#, 50#
- RFA-5 — 10#, 25#, 50#
- Top Calf — 10#, 25#, 50#

---

## 7. Grid Configuration

These constants are hardcoded in the frontend. The backend doesn't need to enforce the grid size for MVP, but the export format includes them for future flexibility.

| Constant    | Value |
|-------------|-------|
| `GRID_ROWS` | 16    |
| `GRID_COLS` | 16    |
| West door   | row 0, cols 7–8 |
| East door   | row 15, cols 7–8 |

---

## 8. Undo / History

Currently implemented as a client-side array of up to 50 snapshots. Two options for the backend:

1. **Keep undo client-side** — the backend doesn't need to know about it. The client maintains its snapshot array using API responses. This is lowest lift.
2. **Server-side audit log** — store every mutation as an event; expose `GET /audit-log` and `POST /undo`. Enables cross-device undo and history visibility. Nice to have.

Recommend starting with option 1.

---

## 9. Authentication

The app has no auth today. For a warehouse with a single team, options in increasing complexity:

1. **Shared secret / API key** in an env var — simplest, no user management
2. **Single password** (HTTP Basic or simple session) — keeps it team-only
3. **Per-user accounts** — only needed if you want per-user audit trails

---

## 10. Migration from localStorage

On first load after backend integration, the frontend should:

1. `GET /pallets` — if the response is empty, optionally offer to migrate data from `localStorage`.
2. If migrating: read `localStorage.getItem('warehouse_v3:pallets')`, `POST /import/json` with a wrapped payload, then clear localStorage.

---

## 11. Frontend Integration Notes

- The frontend currently does all persistence in two `useEffect` hooks in `WarehouseMap` (lines 112–124 of the JSX). Replace these with API calls.
- The `validatePallet` function (line 62) mirrors the server-side constraints — keep them in sync.
- Feedback toasts auto-dismiss after 4 seconds; API errors should surface through the existing `showFeedback('error', message)` path.
- The undo stack (`history` state) can stay client-side for MVP — just replace the localStorage snapshot with the API response on each mutation.
