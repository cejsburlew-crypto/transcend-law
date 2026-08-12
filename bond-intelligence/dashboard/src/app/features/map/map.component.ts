import { Component, OnInit, OnDestroy, inject, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AgencyService } from '../../core/services/agency.service';
import { TileLayers } from '@ssp-shared/leaflet/tile-layers';
import * as L from 'leaflet';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private agencyService = inject(AgencyService);
  private map: any;
  private markers: any[] = [];

  loading = true;
  agencies: any[] = [];
  filteredAgencies: any[] = [];
  selectedState = '';
  states = ['CA','TX','FL','AZ','OR','WA','CO','MI','NY'];

  // State capital fallback coordinates
  private STATE_COORDS: Record<string, [number, number]> = {
    CA: [36.7783, -119.4179], TX: [31.9686, -99.9018], FL: [27.9944, -81.7603],
    AZ: [34.0489, -111.0937], OR: [43.8041, -120.5542], WA: [47.7511, -120.7401],
    CO: [39.5501, -105.7821], MI: [44.3148, -85.6024], NY: [42.1657, -74.9481]
  };

  ngAfterViewInit(): void {
    this.initMap();
    this.loadData();
  }

  ngOnDestroy(): void {
    if (this.map) { this.map.remove(); }
  }

  private initMap(): void {
    this.map = L.map('map', { center: [37.5, -96], zoom: 4 });
    L.tileLayer(TileLayers.osm.url, TileLayers.osm.options).addTo(this.map);
  }

  private loadData(): void {
    this.agencyService.getMapData().subscribe({
      next: res => {
        this.agencies = res.data;
        this.filteredAgencies = res.data;
        this.loading = false;
        this.plotMarkers(res.data);
      },
      error: () => { this.loading = false; }
    });
  }

  private plotMarkers(agencies: any[]): void {
    this.markers.forEach(m => this.map.removeLayer(m));
    this.markers = [];

    agencies.forEach(agency => {
      let lat = agency.lat;
      let lng = agency.lng;

      if (!lat || !lng) {
        const coords = this.STATE_COORDS[agency.state];
        if (!coords) return;
        // Scatter slightly so markers don't pile up
        lat = coords[0] + (Math.random() - 0.5) * 2;
        lng = coords[1] + (Math.random() - 0.5) * 3;
      }

      const score = agency.score || 0;
      const color = score >= 70 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 30 ? '#3b82f6' : '#6b7280';

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;border-radius:50%;
          background:${color};color:#fff;
          display:flex;align-items:center;justify-content:center;
          font-size:10px;font-weight:700;
          border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
        ">${score}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14]
      });

      const marker = L.marker([lat, lng], { icon })
        .bindPopup(`
          <div style="min-width:200px;font-family:Inter,sans-serif">
            <strong style="font-size:14px">${agency.name}</strong>
            <div style="color:#64748b;font-size:12px;margin:4px 0">${agency.state} · ${agency.agency_type || ''}</div>
            <div style="display:flex;gap:8px;align-items:center;margin:6px 0">
              <span style="background:${color}22;color:${color};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">Score: ${score}</span>
              <span style="font-size:12px;color:#475569">${agency.stage || ''}</span>
            </div>
            <div style="font-size:12px;color:#0f172a;font-weight:600">${agency.bond_amount ? '$' + (agency.bond_amount/1e6).toFixed(1) + 'M' : ''}</div>
            <a href="/agencies/${agency.id}" style="display:block;margin-top:8px;text-align:center;padding:6px;background:#0a1628;color:#fff;border-radius:4px;font-size:12px;font-weight:600;text-decoration:none">View Details</a>
          </div>
        `);

      marker.addTo(this.map);
      this.markers.push(marker);
    });
  }

  filterByState(): void {
    const filtered = this.selectedState
      ? this.agencies.filter(a => a.state === this.selectedState)
      : this.agencies;
    this.filteredAgencies = filtered;
    this.plotMarkers(filtered);
  }
}
