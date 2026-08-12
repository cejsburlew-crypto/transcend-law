# @ssp-shared — Transcend SSP Shared Library

Shared TypeScript code used by both Angular frontends in this monorepo.

## Consumed by

| App | Path |
|-----|------|
| Bond Intelligence dashboard | `bond-intelligence/dashboard/` |
| Site Safety Plan frontend   | `frontend/` |

## Path alias

Both projects resolve `@ssp-shared/*` via `tsconfig.json` `paths`:

```json
"paths": {
  "@ssp-shared": ["../../shared/index.ts"],
  "@ssp-shared/*": ["../../shared/*"]
}
```

## Contents

| Module | Import | Purpose |
|--------|--------|---------|
| `ApiResponse<T>`, `PaginationMeta` | `@ssp-shared/models/api-response.model` | Typed CI4 API envelope |
| `downloadBlob(blob, filename)` | `@ssp-shared/utils/blob-download` | Browser file download from Blob |
| `TileLayers`, `SatelliteWithLabels` | `@ssp-shared/leaflet/tile-layers` | Leaflet tile-layer URL/options configs |
| `LoadingSpinnerComponent` | `@ssp-shared/components/loading-spinner/loading-spinner.component` | Branded loading spinner (Angular 17+) |

## Tile layer usage

```typescript
import { TileLayers, SatelliteWithLabels } from '@ssp-shared/leaflet/tile-layers';

// Agency overview map — street
L.tileLayer(TileLayers.osm.url, TileLayers.osm.options).addTo(map);

// Site safety plan — satellite + labels
SatelliteWithLabels.forEach(layer => L.tileLayer(layer.url, layer.options).addTo(map));
```

## Adding shared code

1. Create the file under `shared/`
2. Export it from `shared/index.ts`
3. Import via `@ssp-shared/...` in either app
4. Do **not** add Angular-version-specific APIs (target Angular 17 baseline for compatibility)
