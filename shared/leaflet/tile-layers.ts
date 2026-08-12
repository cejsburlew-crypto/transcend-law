/**
 * Centralized Leaflet tile-layer configurations for all Transcend SSP maps.
 *
 * Usage (requires global `declare const L: any` in consuming component):
 *
 *   import { TileLayers } from '@ssp-shared/leaflet/tile-layers';
 *
 *   // Street map (agency overview, route planning)
 *   L.tileLayer(TileLayers.osm.url, TileLayers.osm.options).addTo(map);
 *
 *   // Satellite (site safety plans, site inspection)
 *   L.tileLayer(TileLayers.esriSatellite.url, TileLayers.esriSatellite.options).addTo(map);
 *   L.tileLayer(TileLayers.esriLabels.url,     TileLayers.esriLabels.options).addTo(map);
 */

export interface TileLayerDef {
  url: string;
  options: Record<string, unknown>;
}

export const TileLayers = {
  /** OpenStreetMap — good for overviews, regional maps, agency location maps */
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  } as TileLayerDef,

  /** ESRI World Imagery — high-res satellite/aerial, ideal for site safety plans */
  esriSatellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 21,
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    },
  } as TileLayerDef,

  /**
   * ESRI Reference labels overlay — roads, place names, building labels.
   * Always add on top of esriSatellite at reduced opacity for readability.
   */
  esriLabels: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 21,
      opacity: 0.7,
      attribution: '',
    },
  } as TileLayerDef,

  /** ESRI Street Map — alternative street-level base (cleaner than OSM for print/PDF) */
  esriStreet: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 20,
      attribution: 'Map &copy; Esri',
    },
  } as TileLayerDef,
} as const;

/** Convenience: satellite + labels as a pair (for site safety plan maps) */
export const SatelliteWithLabels: TileLayerDef[] = [
  TileLayers.esriSatellite,
  TileLayers.esriLabels,
];
