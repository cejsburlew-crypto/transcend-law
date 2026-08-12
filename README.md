# transcend-ssp

Standalone **Site Safety Plan (SSP)** add-on for [Transcend PM](https://app.transcendpm.com). Guides users through a six-step workflow aligned with **CFC §3303.1.1** and **BU 24-05**.

## Stack

- **Frontend:** Angular 19 (6-step wizard, Leaflet plot plan)
- **Backend:** PHP 8.3 REST API + Dompdf
- **Database:** SQLite (dev)

## Quick start (Docker)

```bash
cd ~/code/transcend-ssp
docker compose up --build
```

| Service | URL |
|---------|-----|
| Angular UI | http://localhost:4200 |
| PHP API | http://localhost:8080/api/health |

## Workflow (6 steps)

1. **Site address** — lookup fills site name, property owner, APN, emergency services
2. **Plot plan** — LA County parcel boundary, service layers, hydrant/FDC labels
3. **DSA A#** — pull project name & scope from catalog (`03-125694` = Longley Way example)
4. **Safety plan** — CFC #1–13 fields, draw fire routes, **Export plansheet PDF** (landscape site plan + SSP table)
5. **LFA approval** — upload approved sheets, **Download submission package (ZIP)**
6. **Contractor** — select GC from project directory, save & finish

Try **Load Longley Way example** on a new plan to walk through with real Arcadia data.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/lookup-address` | Geocode, APN, site name, emergency services |
| POST | `/api/lookup-parcel` | Parcel boundary GeoJSON |
| POST | `/api/lookup-dsa-project` | Project metadata by DSA A# |
| GET/POST/PUT/DELETE | `/api/ssp` | CRUD Site Safety Plans |
| GET | `/api/ssp/{id}/export-pdf` | Plansheet + SSP PDF |
| GET | `/api/ssp/{id}/export-package` | ZIP (PDF + LFA uploads + manifest) |
| GET/POST | `/api/ssp/{id}/attachments` | Fire dept approved sheet uploads |

## Reference

- Sample submission: `docs/reference/03-125694 Longley Way Safety Plan.pdf`
- CFC outline: `docs/reference/SSP-TEMPLATE-OUTLINE.md`

## Transcend PM integration (future)

Store `transcend_pm_org_id` and `transcend_pm_project_id` for live project/contractor pull (skipped for now — local DSA catalog used).

## Project structure

```
transcend-ssp/
├── backend/          PHP API, Dompdf export
├── frontend/         Angular wizard + map
├── docs/reference/   Longley Way SSP PDF + seed data
└── docker-compose.yml
```
