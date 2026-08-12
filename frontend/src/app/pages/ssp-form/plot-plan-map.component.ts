import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapLabel, MapLayersState, ServiceMarker } from '../../models/site-safety-plan.model';
import { SatelliteWithLabels } from '@ssp-shared/leaflet/tile-layers';

declare const L: any;

@Component({
  selector: 'app-plot-plan-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plot-plan-map.component.html',
  styleUrls: ['./plot-plan-map.component.css'],
})
export class PlotPlanMapComponent implements OnChanges, OnDestroy {
  @ViewChild('mapHost', { static: true }) mapHost!: ElementRef<HTMLDivElement>;
  @Input() layers: MapLayersState | null = null;
  @Input() drawingMode = false;
  @Output() layersChange = new EventEmitter<MapLayersState>();
  @Output() drawingChange = new EventEmitter<{ x: number; y: number }[]>();

  labelType: MapLabel['type'] = 'hydrant';
  labelText = '';
  placingLabel = false;

  private map: any;
  private parcelLayer: any;
  private serviceLayer: any;
  private labelLayer: any;
  private drawLayer: any;
  private currentStroke: { x: number; y: number }[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['drawingMode'] && this.map) {
      if (this.drawingMode) {
        this.enableDrawing();
      } else {
        this.disableDrawing();
      }
    }

    if (changes['layers'] && this.layers) {
      if (!this.map) {
        this.initMap();
      } else {
        this.renderLayers();
      }
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  serviceVisible(key: keyof MapLayersState['services']): boolean {
    if (!this.layers) {
      return false;
    }
    const marker = this.layers.services[key];
    return marker?.visible ?? false;
  }

  toggleService(key: keyof MapLayersState['services']): void {
    if (!this.layers) {
      return;
    }
    const marker = this.layers.services[key];
    if (!marker) {
      return;
    }
    marker.visible = !marker.visible;
    this.emitLayers();
    this.renderServiceMarkers();
  }

  startPlaceLabel(): void {
    this.placingLabel = true;
  }

  /** Capture the current map view as a JPEG data URL for PDF export. */
  async captureSnapshot(): Promise<string | null> {
    if (!this.map) {
      return null;
    }

    this.map.invalidateSize();

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(this.mapHost.nativeElement, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 1,
      });

      return canvas.toDataURL('image/jpeg', 0.82);
    } catch {
      return null;
    }
  }

  private initMap(): void {
    if (!this.layers) return;

    this.map = L.map(this.mapHost.nativeElement, {
      center: [this.layers.site.lat, this.layers.site.lng],
      zoom: 18,
      zoomControl: true,
    });

    // Satellite + label overlay from shared tile-layer config
    SatelliteWithLabels.forEach(layer => L.tileLayer(layer.url, layer.options).addTo(this.map));

    this.parcelLayer = L.layerGroup().addTo(this.map);
    this.serviceLayer = L.layerGroup().addTo(this.map);
    this.labelLayer = L.layerGroup().addTo(this.map);
    this.drawLayer = L.layerGroup().addTo(this.map);

    this.map.on('click', (event: any) => this.onMapClick(event));

    if (this.drawingMode) {
      this.enableDrawing();
    }

    this.renderLayers();
    setTimeout(() => this.map.invalidateSize(), 100);
  }

  private onMapClick(event: any): void {
    if (this.placingLabel && this.labelText.trim() && this.layers) {
      const label: MapLabel = {
        id: crypto.randomUUID(),
        lat: event.latlng.lat,
        lng: event.latlng.lng,
        text: this.labelText.trim(),
        type: this.labelType,
      };
      this.layers.customLabels = [...this.layers.customLabels, label];
      this.labelText = '';
      this.placingLabel = false;
      this.emitLayers();
      this.renderLabels();
      return;
    }
  }

  private renderLayers(): void {
    if (!this.map || !this.layers) return;

    this.parcelLayer.clearLayers();
    this.renderServiceMarkers();
    this.renderLabels();

    L.circleMarker([this.layers.site.lat, this.layers.site.lng], {
      radius: 8,
      color: '#0b3d6d',
      fillColor: '#1a73c7',
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindTooltip('Project site', { permanent: false })
      .addTo(this.parcelLayer);

    if (this.layers.parcel?.coordinates?.[0]?.length) {
      const latLngs = this.layers.parcel.coordinates[0].map(([lng, lat]) => [lat, lng]);
      L.polygon(latLngs, {
        color: '#0b3d6d',
        weight: 2,
        fillColor: '#7eb8e8',
        fillOpacity: 0.15,
      })
        .bindTooltip(`APN parcel`, { sticky: true })
        .addTo(this.parcelLayer);
      this.map.fitBounds(L.polygon(latLngs).getBounds(), { padding: [24, 24] });
    }
  }

  private renderServiceMarkers(): void {
    if (!this.layers) return;
    this.serviceLayer.clearLayers();

    const colors: Record<string, string> = {
      hospital: '#b00020',
      urgent_care: '#e65100',
      fire: '#c62828',
      police: '#1565c0',
    };

    Object.entries(this.layers.services).forEach(([key, marker]) => {
      const service = marker as ServiceMarker | undefined;
      if (!service?.visible || !service.lat || !service.lng) return;

      L.circleMarker([service.lat, service.lng], {
        radius: 7,
        color: colors[key] ?? '#333',
        fillColor: colors[key] ?? '#333',
        fillOpacity: 0.85,
        weight: 2,
      })
        .bindTooltip(`<strong>${service.name}</strong><br>${service.address ?? ''}`)
        .addTo(this.serviceLayer);
    });
  }

  private renderLabels(): void {
    if (!this.layers) return;
    this.labelLayer.clearLayers();

    this.layers.customLabels.forEach((label) => {
      L.marker([label.lat, label.lng], {
        icon: L.divIcon({
          className: 'map-label-icon',
          html: `<span>${label.text}</span>`,
        }),
      })
        .bindTooltip(`${label.type}: ${label.text}`)
        .addTo(this.labelLayer);
    });
  }

  enableDrawing(): void {
    if (!this.map) return;
    this.map.dragging.disable();
    this.map.doubleClickZoom.disable();
    this.map.on('mousedown', this.onDrawStart);
    this.map.on('mousemove', this.onDrawMove);
    this.map.on('mouseup', this.onDrawEnd);
  }

  disableDrawing(): void {
    if (!this.map) return;
    this.map.dragging.enable();
    this.map.doubleClickZoom.enable();
    this.map.off('mousedown', this.onDrawStart);
    this.map.off('mousemove', this.onDrawMove);
    this.map.off('mouseup', this.onDrawEnd);
  }

  private onDrawStart = (event: any): void => {
    this.currentStroke = [{ x: event.containerPoint.x, y: event.containerPoint.y }];
  };

  private onDrawMove = (event: any): void => {
    if (this.currentStroke.length === 0) return;
    const point = { x: event.containerPoint.x, y: event.containerPoint.y };
    const last = this.currentStroke[this.currentStroke.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) < 3) return;
    this.currentStroke.push(point);
    const latLngs = this.currentStroke.map((p) => this.map.containerPointToLatLng([p.x, p.y]));
    this.drawLayer.clearLayers();
    L.polyline(latLngs, { color: '#d32f2f', weight: 3 }).addTo(this.drawLayer);
  };

  private onDrawEnd = (): void => {
    if (this.currentStroke.length > 1) {
      this.drawingChange.emit([...this.currentStroke]);
    }
    this.currentStroke = [];
  };

  private emitLayers(): void {
    if (this.layers) {
      this.layersChange.emit(structuredClone(this.layers));
    }
  }
}
