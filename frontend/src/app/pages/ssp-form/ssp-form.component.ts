import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { SspService } from '../../services/ssp.service';
import {
  DSA_APPLICATION_PATTERN,
  AddressLookupResult,
  DsaProjectLookupResult,
  DrawingStroke,
  MapLayersState,
  PlanDrawingState,
  ProjectContractor,
  SiteSafetyPlan,
  SspAttachment,
  suggestedPdfFileName,
} from '../../models/site-safety-plan.model';
import { PlotPlanMapComponent } from './plot-plan-map.component';
import { downloadBlob } from '@ssp-shared/utils/blob-download';

function dsaApplicationValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  if (!value) return null;
  return DSA_APPLICATION_PATTERN.test(value) ? null : { dsaApplication: true };
}

@Component({
  selector: 'app-ssp-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PlotPlanMapComponent],
  templateUrl: './ssp-form.component.html',
  styleUrls: ['./ssp-form.component.css'],
})
export class SspFormComponent implements OnInit {
  @ViewChild('plotMapStep4') plotMapStep4?: PlotPlanMapComponent;
  @ViewChild('plotMapStep2') plotMapStep2?: PlotPlanMapComponent;

  private fb = inject(FormBuilder);
  private ssp = inject(SspService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly steps = [
    { num: 1, title: 'Site address', summary: 'Property owner & site name' },
    { num: 2, title: 'Plot plan', summary: 'APN parcel & service layers' },
    { num: 3, title: 'DSA project', summary: 'A# → name & scope' },
    { num: 4, title: 'Safety plan', summary: 'Draw & export PDF' },
    { num: 5, title: 'LFA approval', summary: 'Upload approved sheets' },
    { num: 6, title: 'Contractor', summary: 'Project directory' },
  ];

  currentStep = 1;
  isEdit = false;
  planId?: number;
  saving = false;
  lookupInProgress = false;
  dsaLookupInProgress = false;
  parcelLoading = false;
  exportInProgress = false;
  packageExportInProgress = false;
  uploadInProgress = false;
  message = '';
  messageOk = false;
  private lastLookupAddress = '';
  lookupCounty = '';
  serviceCoords: Record<string, { lat: number; lng: number }> = {};
  mapLayers: MapLayersState | null = null;
  planDrawing: PlanDrawingState = { strokes: [] };
  projectContractors: ProjectContractor[] = [];
  attachments: SspAttachment[] = [];
  selectedUploadFile: File | null = null;

  form = this.fb.group({
    project_address: [''],
    site_name: [''],
    property_owner: [''],
    hospital_name: [''],
    hospital_address: [''],
    hospital_phone: [''],
    urgent_care_name: [''],
    urgent_care_address: [''],
    urgent_care_phone: [''],
    fire_department_name: [''],
    fire_department_address: [''],
    fire_department_phone_emergency: ['911'],
    fire_department_phone_non_emergency: [''],
    fire_department_phone: [''],
    police_department_name: [''],
    police_department_address: [''],
    police_department_phone_emergency: ['911'],
    police_department_phone_non_emergency: [''],
    police_department_phone: [''],
    transcend_pm_org_id: [''],
    transcend_pm_project_id: ['', dsaApplicationValidator],
    submission_date: [new Date().toISOString().slice(0, 10)],
    project_name: [''],
    scope_of_work: [''],
    apn: [''],
    site_lat: [0],
    site_lng: [0],
    map_layers: [''],
    plan_drawing: [''],
    map_snapshot: [''],
    owner_name: [''],
    architect_firm: [''],
    general_contractor: [''],
    contractor_id: [''],
    contractor_contact_name: [''],
    contractor_phone: [''],
    contractor_email: [''],
    site_superintendent: [''],
    site_safety_director_name: [''],
    site_safety_director_phone: [''],
    site_safety_director_email: [''],
    lfa_contact_name: [''],
    lfa_contact_title: [''],
    lfa_contact_phone: [''],
    lfa_contact_email: [''],
    site_safety_director_training: [''],
    fire_watch_training: [''],
    fire_access_routes: [''],
    fire_protection_equipment: [''],
    smoking_cooking_policy: [''],
    temporary_heating_plan: [''],
    hot_work_plan: [''],
    combustible_waste_plan: [''],
    flammable_materials_storage: [''],
    site_security_plan: [''],
    plan_changes_procedure: [''],
    lfa_site_specific: [''],
    incident_reporting: [''],
    effective_date: [''],
    prepared_by: [''],
    status: ['draft'],
  });

  get pdfFileName(): string {
    return suggestedPdfFileName(this.form.getRawValue() as SiteSafetyPlan);
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'new') {
      this.isEdit = true;
      this.planId = Number(idParam);
      this.ssp.get(this.planId).subscribe({
        next: (plan) => {
          this.form.patchValue(this.withEmergencyDefaults(plan));
          this.lastLookupAddress = (plan.project_address ?? '').trim();
          this.restoreMapState(plan);
          this.loadAttachments();
        },
        error: () => {
          this.message = 'Plan not found.';
          this.messageOk = false;
        },
      });
      return;
    }

    const prefillAddress = this.route.snapshot.queryParamMap.get('address');
    if (prefillAddress) {
      this.form.patchValue({ project_address: prefillAddress });
      this.lookupFromAddress();
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= 6) {
      this.currentStep = step;
      if (step === 2 && this.mapLayers) {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
      }
    }
  }

  nextStep(): void {
    if (this.currentStep === 1 && !this.form.controls.project_address.value?.trim()) {
      this.messageOk = false;
      this.message = 'Enter a site address before continuing.';
      return;
    }
    if (this.currentStep === 3 && this.form.controls.transcend_pm_project_id.invalid) {
      this.messageOk = false;
      this.message = 'Enter a valid DSA A# (xx-xxxxxx) or skip lookup.';
      return;
    }
    this.message = '';
    this.goToStep(this.currentStep + 1);
  }

  prevStep(): void {
    this.goToStep(this.currentStep - 1);
  }

  loadLongleyWayExample(): void {
    this.http.get<Partial<SiteSafetyPlan> & { runAddressLookup?: boolean }>('/assets/longley-way-seed.json').subscribe({
      next: (seed) => {
        const { runAddressLookup, ...fields } = seed;
        this.form.patchValue(this.withEmergencyDefaults(fields));
        this.messageOk = true;
        this.message = 'Loaded Longley Way reference.';
        if (runAddressLookup && fields.project_address) {
          this.lookupFromAddress(true);
        }
        if (fields.transcend_pm_project_id) {
          this.lookupDsaProject(true);
        }
      },
      error: () => {
        this.messageOk = false;
        this.message = 'Could not load reference template.';
      },
    });
  }

  onAddressBlur(): void {
    const address = (this.form.controls.project_address.value ?? '').trim();
    if (!address || address === this.lastLookupAddress) return;
    this.lookupFromAddress();
  }

  lookupFromAddress(force = false): void {
    const address = (this.form.controls.project_address.value ?? '').trim();
    if (!address || this.lookupInProgress) return;
    if (!force && address === this.lastLookupAddress) return;

    this.lookupInProgress = true;
    this.message = '';

    this.ssp.lookupAddress(address).subscribe({
      next: (res) => {
        this.applyAddressLookup(res.data, res.meta);
        this.lastLookupAddress = (res.data.project_address ?? address).trim();
        this.messageOk = true;
        this.message = 'Site name, property owner, APN, and emergency services prepopulated.';
        this.lookupInProgress = false;
        this.loadParcelForPlot();
      },
      error: (err) => {
        this.messageOk = false;
        this.message = err?.error?.error ?? 'Address lookup failed. Enter fields manually.';
        this.lookupInProgress = false;
      },
    });
  }

  loadParcelForPlot(): void {
    const lat = Number(this.form.controls.site_lat.value);
    const lng = Number(this.form.controls.site_lng.value);
    const apn = (this.form.controls.apn.value ?? '').trim();
    if (!lat || !lng) return;

    this.parcelLoading = true;
    this.ssp.lookupParcel({ lat, lng, apn, county: this.lookupCounty }).subscribe({
      next: (parcel) => {
        this.mapLayers = this.buildMapLayers(lat, lng, parcel.geometry ?? null);
        this.syncMapLayersToForm();
        this.parcelLoading = false;
      },
      error: () => {
        this.mapLayers = this.buildMapLayers(lat, lng, null);
        this.syncMapLayersToForm();
        this.parcelLoading = false;
      },
    });
  }

  lookupDsaProject(silent = false): void {
    const dsa = (this.form.controls.transcend_pm_project_id.value ?? '').trim();
    if (!dsa || this.dsaLookupInProgress) return;

    this.dsaLookupInProgress = true;
    if (!silent) this.message = '';

    this.ssp.lookupDsaProject(dsa).subscribe({
      next: (res) => {
        if (res.data) {
          this.form.patchValue(this.withEmergencyDefaults(this.dsaToFormPatch(res.data)));
        }
        this.projectContractors = res.contractors ?? [];
        this.dsaLookupInProgress = false;
        if (res.error && !res.data) {
          this.messageOk = false;
          this.message = res.error;
          return;
        }
        this.messageOk = true;
        this.message = res.data
          ? 'Project name and scope loaded from catalog (Transcend PM integration pending).'
          : 'No catalog match.';
      },
      error: (err) => {
        this.dsaLookupInProgress = false;
        this.messageOk = false;
        this.message = err?.error?.error ?? 'DSA project lookup failed.';
      },
    });
  }

  onMapLayersChange(layers: MapLayersState): void {
    this.mapLayers = layers;
    this.syncMapLayersToForm();
    this.syncLabelsToTextFields(layers);
  }

  onDrawingChange(points: { x: number; y: number }[]): void {
    const stroke: DrawingStroke = { color: '#d32f2f', width: 3, points };
    this.planDrawing.strokes = [...this.planDrawing.strokes, stroke];
    this.form.patchValue({ plan_drawing: JSON.stringify(this.planDrawing) });
  }

  async exportPackage(): Promise<void> {
    this.packageExportInProgress = true;
    this.message = '';
    try {
      await this.captureMapSnapshot();
      const id = await this.ensureSaved();
      this.ssp.exportPackage(id).subscribe({
        next: (blob) => {
          downloadBlob(blob, `${this.form.controls.transcend_pm_project_id.value || 'ssp'}_submission_package.zip`);
          this.packageExportInProgress = false;
          this.messageOk = true;
          this.message = 'Submission package downloaded.';
        },
        error: () => {
          this.packageExportInProgress = false;
          this.messageOk = false;
          this.message = 'Package export failed.';
        },
      });
    } catch {
      this.packageExportInProgress = false;
      this.messageOk = false;
      this.message = 'Save the plan before exporting the package.';
    }
  }

  async exportPdf(): Promise<void> {
    this.exportInProgress = true;
    this.message = '';
    try {
      await this.captureMapSnapshot();
      const id = await this.ensureSaved();
      this.ssp.exportPdf(id).subscribe({
        next: (blob) => {
          downloadBlob(blob, this.pdfFileName);
          this.exportInProgress = false;
          this.messageOk = true;
          this.message = 'Plansheet exported.';
        },
        error: () => {
          this.exportInProgress = false;
          this.messageOk = false;
          this.message = 'PDF export failed. Save the plan and try again.';
        },
      });
    } catch {
      this.exportInProgress = false;
      this.messageOk = false;
      this.message = 'Save the plan before exporting.';
    }
  }

  onUploadSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedUploadFile = input.files?.[0] ?? null;
  }

  uploadAttachment(): void {
    if (!this.selectedUploadFile) return;

    this.uploadInProgress = true;
    this.ensureSaved()
      .then((id) => {
        this.ssp.uploadAttachment(id, this.selectedUploadFile!).subscribe({
          next: () => {
            this.selectedUploadFile = null;
            this.uploadInProgress = false;
            this.messageOk = true;
            this.message = 'Fire department approved sheet uploaded.';
            this.loadAttachments();
          },
          error: () => {
            this.uploadInProgress = false;
            this.messageOk = false;
            this.message = 'Upload failed.';
          },
        });
      })
      .catch(() => {
        this.uploadInProgress = false;
        this.messageOk = false;
        this.message = 'Save the plan before uploading.';
      });
  }

  selectContractor(contractor: ProjectContractor): void {
    this.form.patchValue({
      contractor_id: contractor.id,
      general_contractor: contractor.name,
      contractor_contact_name: contractor.contact_name ?? '',
      contractor_phone: contractor.phone ?? '',
      contractor_email: contractor.email ?? '',
    });
  }

  save(): void {
    if (this.form.invalid) return;

    this.saving = true;
    this.message = '';
    const payload = this.buildPayload();

    const req = this.isEdit && this.planId
      ? this.ssp.update(this.planId, payload)
      : this.ssp.create(payload);

    req.subscribe({
      next: (plan) => {
        this.planId = plan.id;
        this.isEdit = true;
        this.messageOk = true;
        this.message = 'Site Safety Plan saved.';
        this.saving = false;
      },
      error: () => {
        this.messageOk = false;
        this.message = 'Save failed. Is the API running?';
        this.saving = false;
      },
    });
  }

  saveAndFinish(): void {
    this.save();
    setTimeout(() => this.router.navigate(['/']), 800);
  }

  private async captureMapSnapshot(): Promise<void> {
    const map = this.currentStep === 4 ? this.plotMapStep4 : this.plotMapStep2 ?? this.plotMapStep4;
    const snapshot = await map?.captureSnapshot();
    if (snapshot) {
      this.form.patchValue({ map_snapshot: snapshot });
    }
  }

  private ensureSaved(): Promise<number> {
    if (this.planId) {
      return this.persistPlan().then(() => this.planId!);
    }
    return this.persistPlan().then((plan) => {
      this.planId = plan.id;
      this.isEdit = true;
      return plan.id!;
    });
  }

  private persistPlan(): Promise<SiteSafetyPlan> {
    const payload = this.buildPayload();
    const req = this.isEdit && this.planId
      ? this.ssp.update(this.planId, payload)
      : this.ssp.create(payload);

    return new Promise((resolve, reject) => {
      req.subscribe({ next: resolve, error: reject });
    });
  }

  private buildPayload(): SiteSafetyPlan {
    const payload = this.form.getRawValue() as SiteSafetyPlan;
    payload.fire_department_phone = payload.fire_department_phone_non_emergency ?? payload.fire_department_phone;
    payload.police_department_phone = payload.police_department_phone_non_emergency ?? payload.police_department_phone;

    if (!payload.project_name?.trim()) {
      payload.project_name = payload.site_name?.trim()
        || (payload.transcend_pm_project_id ? `Site Safety Plan ${payload.transcend_pm_project_id}` : 'Site Safety Plan');
    }

    return payload;
  }

  private loadAttachments(): void {
    if (!this.planId) return;
    this.ssp.listAttachments(this.planId).subscribe({
      next: (items) => (this.attachments = items),
    });
  }

  private restoreMapState(plan: SiteSafetyPlan): void {
    if (plan.map_layers) {
      try {
        this.mapLayers = JSON.parse(plan.map_layers);
      } catch {
        this.mapLayers = null;
      }
    }
    if (plan.plan_drawing) {
      try {
        this.planDrawing = JSON.parse(plan.plan_drawing);
      } catch {
        this.planDrawing = { strokes: [] };
      }
    }
    if (!this.mapLayers && plan.site_lat && plan.site_lng) {
      this.loadParcelForPlot();
    }
    if (plan.transcend_pm_project_id) {
      this.lookupDsaProject(true);
    }
  }

  private buildMapLayers(
    lat: number,
    lng: number,
    parcel: MapLayersState['parcel'] | null
  ): MapLayersState {
    const v = this.form.getRawValue();
    const str = (value: string | null | undefined) => value ?? undefined;

    return {
      site: { lat, lng },
      parcel,
      services: {
        hospital: this.serviceFromForm(str(v.hospital_name), str(v.hospital_address), this.serviceCoords['hospital']?.lat, this.serviceCoords['hospital']?.lng, true),
        urgent_care: this.serviceFromForm(str(v.urgent_care_name), str(v.urgent_care_address), this.serviceCoords['urgent_care']?.lat, this.serviceCoords['urgent_care']?.lng, true),
        fire: this.serviceFromForm(str(v.fire_department_name), str(v.fire_department_address), this.serviceCoords['fire']?.lat, this.serviceCoords['fire']?.lng, true),
        police: this.serviceFromForm(str(v.police_department_name), str(v.police_department_address), this.serviceCoords['police']?.lat, this.serviceCoords['police']?.lng, false),
      },
      customLabels: this.mapLayers?.customLabels ?? [],
    };
  }

  private serviceFromForm(
    name?: string,
    address?: string,
    siteLat?: number,
    siteLng?: number,
    visible = true
  ) {
    return {
      name: name ?? '',
      address: address ?? '',
      lat: siteLat ?? 0,
      lng: siteLng ?? 0,
      visible: visible && !!name,
    };
  }

  private syncMapLayersToForm(): void {
    if (this.mapLayers) {
      this.form.patchValue({ map_layers: JSON.stringify(this.mapLayers) });
    }
  }

  private syncLabelsToTextFields(layers: MapLayersState): void {
    const hydrants = layers.customLabels.filter((l) => l.type === 'hydrant').map((l) => l.text).join('; ');
    const fdc = layers.customLabels.filter((l) => l.type === 'fdc').map((l) => l.text).join('; ');
    const routes = layers.customLabels.filter((l) => l.type === 'route').map((l) => l.text).join('; ');

    const equipment = [hydrants && `Hydrants: ${hydrants}`, fdc && `FDC: ${fdc}`].filter(Boolean).join('\n');
    if (equipment) {
      this.form.patchValue({ fire_protection_equipment: equipment });
    }
    if (routes) {
      this.form.patchValue({ fire_access_routes: routes });
    }
  }

  private applyAddressLookup(data: AddressLookupResult, meta: { lat?: number; lng?: number; county?: string }): void {
    this.form.patchValue(this.withEmergencyDefaults(this.addressToFormPatch(data, meta)));
    this.lookupCounty = meta.county ?? '';
    this.serviceCoords = {
      hospital: { lat: Number(data.hospital_lat) || meta.lat || 0, lng: Number(data.hospital_lng) || meta.lng || 0 },
      urgent_care: { lat: Number(data.urgent_care_lat) || 0, lng: Number(data.urgent_care_lng) || 0 },
      fire: { lat: Number(data.fire_department_lat) || 0, lng: Number(data.fire_department_lng) || 0 },
      police: { lat: Number(data.police_department_lat) || 0, lng: Number(data.police_department_lng) || 0 },
    };
  }

  private addressToFormPatch(
    data: AddressLookupResult,
    meta: { lat?: number; lng?: number }
  ): Partial<SiteSafetyPlan> {
    return {
      project_address: data.project_address,
      site_name: data.site_name,
      property_owner: data.property_owner,
      owner_name: data.owner_name,
      apn: data.apn,
      site_lat: data.site_lat ?? meta.lat,
      site_lng: data.site_lng ?? meta.lng,
      hospital_name: data.hospital_name,
      hospital_address: data.hospital_address,
      hospital_phone: data.hospital_phone,
      urgent_care_name: data.urgent_care_name,
      urgent_care_address: data.urgent_care_address,
      urgent_care_phone: data.urgent_care_phone,
      fire_department_name: data.fire_department_name,
      fire_department_address: data.fire_department_address,
      fire_department_phone_emergency: data.fire_department_phone_emergency,
      fire_department_phone_non_emergency: data.fire_department_phone_non_emergency,
      fire_department_phone: data.fire_department_phone,
      police_department_name: data.police_department_name,
      police_department_address: data.police_department_address,
      police_department_phone_emergency: data.police_department_phone_emergency,
      police_department_phone_non_emergency: data.police_department_phone_non_emergency,
      police_department_phone: data.police_department_phone,
    };
  }

  private dsaToFormPatch(data: DsaProjectLookupResult): Partial<SiteSafetyPlan> {
    return {
      transcend_pm_project_id: data.transcend_pm_project_id,
      transcend_pm_org_id: data.transcend_pm_org_id,
      project_name: data.project_name,
      site_name: data.site_name,
      scope_of_work: data.scope_of_work,
      property_owner: data.property_owner,
      owner_name: data.owner_name,
      architect_firm: data.architect_firm,
      project_address: data.project_address,
    };
  }

  private withEmergencyDefaults(values: Partial<SiteSafetyPlan>): Partial<SiteSafetyPlan> {
    return {
      fire_department_phone_emergency: '911',
      police_department_phone_emergency: '911',
      ...values,
      fire_department_phone_non_emergency:
        values.fire_department_phone_non_emergency
        ?? values.fire_department_phone
        ?? '',
      police_department_phone_non_emergency:
        values.police_department_phone_non_emergency
        ?? values.police_department_phone
        ?? '',
    };
  }
}
