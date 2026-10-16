// src/app/shared/components/ec-resource-sharing-format/ec-resource-sharing-format.component.ts
//
// Forces the "Format" of a Resource Sharing request to a fixed value per view
// (EC views: digital; the EU inter-institutional union view: physical) and hides
// the field so patrons cannot change it — the NDE version of VE's selectFormat().
//
// SETTINGS: the constant RESOURCE_SHARING below — deliberately NOT in the
// settings UI / settings editor (Oct 2026): EC-specific, the same for all EC
// views and not expected to change. (Formerly config resourceSharing.*; values
// moved here unchanged.) The union view's "physical" rule lives in
// src/views/finder/assets/js/unionview.js, not here.
//   forceFormat            'digital' | 'physical' | 'photocopy' | ''  ('' = leave the choice to the patron)
//   hideFormatField        hide the Format field once forced
//   autoCheckAvailability  click "Check availability" after forcing, as VE did
//   formatValues           how to recognise each format in the form definition:
//                          candidate values and labels, plus its position in the
//                          option list (Alma's order: Physical, Digital, Photocopy)
//
// HOW: mounted on `nde-base-request-form-after`, so it renders INSIDE the request
// dialog with the form component as `hostComponent`. NDE builds the form with
// Formly, so the component holds a FormGroup (with a `format` control) and the
// field definitions (with the options' real values). Setting the control is
// language-independent and keeps Angular's form state consistent.
// Only the resource-sharing form has a `format` field; other request forms
// (hold, digitization, purchase) are left untouched.
//
// FALLBACK: if the slot's hostComponent does not expose the form (NDE release
// changed the internals), the option is picked through the Material select by
// POSITION, which does not depend on the UI language either. Either way, the
// host object is logged once when nothing could be found, for diagnosis.
//
// LOGGING: every run writes ONE line per step to the console, prefixed
// "[ec] resource-sharing-format:", so anyone can see what happened without
// reading this file:
//   - "slot rendered …"          the mapping works (no line at all = wrong slot)
//   - "Format field not found"   selector wrong or not the resource-sharing form
//   - "set via form control …"   preferred route worked (shows the value used)
//   - "set via select …"         fallback route used
//   - "already <format>"         nothing to change, still hidden/checked
//   - "could not set …"          both routes failed; host object dumped once
//
// MOUNT POINT: shared-mappings.ts → 'nde-base-request-form-after'
// (if that slot turns out not to render, try 'nde-request-form-after').
import { Component, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';
type Format = 'digital' | 'physical' | 'photocopy';

/** The rules for every EC view — see SETTINGS in the header. */
const RESOURCE_SHARING: {
  forceFormat: '' | Format;
  hideFormatField: boolean;
  autoCheckAvailability: boolean;
  formatFieldSelector: string;
  checkAvailabilitySelector: string;
  formatValues: Record<Format, { values: string[]; labels: string[]; position: number }>;
} = {
  "forceFormat": "digital",
  "hideFormatField": true,
  "autoCheckAvailability": true,
  "formatFieldSelector": "[data-qa=\"almaResourceSharing.format\"]",
  "checkAvailabilitySelector": "nde-formly-check-availability-button button",
  "formatValues": {
    "physical": {
      "values": [
        "PHYSICAL",
        "physical",
        "PHYSICAL_NON_RETURNABLE"
      ],
      "labels": [
        "Physical",
        "Physique",
        "Physisch"
      ],
      "position": 0
    },
    "digital": {
      "values": [
        "DIGITAL",
        "digital",
        "ELECTRONIC"
      ],
      "labels": [
        "Digital",
        "Elektronisch",
        "Numérique",
        "Électronique"
      ],
      "position": 1
    },
    "photocopy": {
      "values": [
        "PHOTOCOPY",
        "photocopy",
        "COPY"
      ],
      "labels": [
        "Fotokopie",
        "Kopie",
        "Photocopie",
        "Photocopy"
      ],
      "position": 2
    }
  }
};

/** Logged once per page load; a wrong assumption is diagnosed from the console, not by trial builds. */
let probeLogged = false;

/** One-line status logging (always on: it fires once per dialog, and it is how this feature is verified). */
const log = (msg: string, ...rest: unknown[]) => console.info(`[ec] resource-sharing-format: ${msg}`, ...rest);

@Component({
  selector: 'custom-ec-resource-sharing-format',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-resource-sharing-format' },
  template: '', // headless: it only manipulates the host form
})
export class EcResourceSharingFormatComponent implements OnInit, OnDestroy {
  /** The nde-base-request-form instance (injected by the NDE shell). */
  @Input() hostComponent: any;

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer = 0;
  private tries = 0;

  ngOnInit(): void {
    const cfg = RESOURCE_SHARING;
    if (!cfg?.forceFormat) { log('slot rendered, forceFormat is empty — leaving the choice to the patron'); return; }
    log(`slot rendered, forceFormat=${cfg.forceFormat}, hostComponent=${this.hostComponent?.constructor?.name ?? typeof this.hostComponent}`);
    // The form renders asynchronously after this slot; poll briefly until the
    // Format field exists (≈5 s max), then act once.
    this.timer = window.setInterval(() => {
      const dialog = this.el.nativeElement.closest<HTMLElement>('mat-dialog-container, nde-base-request-form');
      const field = dialog?.querySelector<HTMLElement>(cfg.formatFieldSelector);
      if (!field) {
        if (++this.tries > 50) {
          this.stop();
          log(`Format field not found within 5 s (selector ${cfg.formatFieldSelector}) — not a resource-sharing form, or NDE markup changed`);
        }
        return;
      }
      this.stop();
      this.apply(cfg.forceFormat as Format, dialog!, field);
    }, 100);
  }

  ngOnDestroy(): void { this.stop(); }
  private stop(): void { if (this.timer) { window.clearInterval(this.timer); this.timer = 0; } }

  private apply(format: Format, dialog: HTMLElement, field: HTMLElement): void {
    const cfg = RESOURCE_SHARING;
    const spec = cfg.formatValues[format];

    let done = this.setViaForm(format, spec);
    if (!done) done = this.setViaSelect(field, spec.position);
    if (!done) { log('could not set the format (no form control and no mat-select found)'); this.probe(); return; }

    if (cfg.hideFormatField) {
      log('Format field hidden');
      // Off-screen rather than display:none: the control stays in the form (and
      // in the accessibility tree), so validation and submission are unaffected.
      field.classList.add('ec-rs-format-locked');
    }
    if (cfg.autoCheckAvailability) {
      // Same as VE: re-run the availability check for the forced format.
      window.setTimeout(() => {
        const btn = dialog.querySelector<HTMLButtonElement>(cfg.checkAvailabilitySelector);
        log(btn ? 'Check availability clicked' : `Check availability button not found (${cfg.checkAvailabilitySelector})`);
        btn?.click();
      }, 150);
    }
  }

  /**
   * Preferred route: through the Formly-driven form on the host component.
   * Finds (1) a FormGroup with a `format` control, (2) the `format` field
   * definition and its options, picks the option whose value or label matches
   * the configured candidates — or, failing that, the one at the known position —
   * and sets the control (+ model, which Formly keeps in step with the control).
   */
  private setViaForm(format: Format, spec: { values: string[]; labels: string[]; position: number }): boolean {
    const hc = this.hostComponent;
    if (!hc) return false;

    const control = this.findControl(hc, 'format');
    if (!control) { log('no "format" form control on hostComponent — trying the select fallback'); return false; }

    const fieldDef = this.findFieldDef(hc, 'format');
    const options = this.optionsOf(fieldDef);
    const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();
    const wanted = [...spec.values, ...spec.labels].map(norm);

    let value: unknown;
    if (options.length) {
      const hit = options.find((o) => wanted.includes(norm(o.value)) || wanted.includes(norm(o.label)))
        ?? options[spec.position];
      value = hit?.value;
    } else {
      value = spec.values[0]; // no option list reachable: trust the configured value
    }
    if (value === undefined) { log('format option list found but no matching value', { options }); return false; }

    const before = control.value;
    if (before === value) {
      log(`already ${format} (value ${JSON.stringify(value)})`);
    } else {
      control.setValue(value);
      control.markAsDirty();
      control.updateValueAndValidity?.();
      if (hc.model && typeof hc.model === 'object') hc.model.format = value;
      log(`set via form control: ${JSON.stringify(before)} → ${JSON.stringify(value)}`, options.length ? { options } : '(no option list; configured value used)');
    }
    return true;
  }

  /** Fallback route: open the Material select and click the option at `position`. */
  private setViaSelect(field: HTMLElement, position: number): boolean {
    const trigger = field.querySelector<HTMLElement>('mat-select');
    if (!trigger) return false;
    log(`set via select: clicking option #${position}`);
    trigger.click(); // opens the overlay panel (rendered at document level)
    const panelId = trigger.id ? `${trigger.id}-panel` : '';
    window.setTimeout(() => {
      const panel = (panelId && document.getElementById(panelId)) || document.querySelector('.mat-mdc-select-panel');
      const option = panel?.querySelectorAll<HTMLElement>('mat-option')[position];
      if (option) option.click(); else trigger.click(); // close again if nothing to pick
    }, 50);
    return true;
  }

  // ---------------------------------------------------------------- lookup helpers

  /** A FormControl named `name` on any FormGroup-like property of the host (or the host itself). */
  private findControl(hc: any, name: string): any {
    const candidates = [hc.form, hc.formGroup, hc.requestForm, hc.formlyForm?.form, hc];
    for (const c of candidates) {
      const ctrl = c?.controls?.[name] ?? c?.get?.(name);
      if (ctrl && typeof ctrl.setValue === 'function') return ctrl;
    }
    return null;
  }

  /** Depth-first search of Formly field configs for `key === name`. */
  private findFieldDef(hc: any, name: string): any {
    const roots = [hc.fields, hc.formlyFields, hc.formFields, hc.config?.fields].filter(Array.isArray);
    const walk = (list: any[], depth = 0): any => {
      if (depth > 8) return null;
      for (const f of list) {
        if (f?.key === name) return f;
        const hit = Array.isArray(f?.fieldGroup) ? walk(f.fieldGroup, depth + 1) : null;
        if (hit) return hit;
      }
      return null;
    };
    for (const r of roots) { const hit = walk(r); if (hit) return hit; }
    return null;
  }

  /** Options of a Formly field, as {value,label}, when they are a plain array (not an observable). */
  private optionsOf(fieldDef: any): Array<{ value: unknown; label: unknown }> {
    const raw = fieldDef?.props?.options ?? fieldDef?.templateOptions?.options;
    return Array.isArray(raw) ? raw.map((o: any) => ({ value: o?.value ?? o, label: o?.label ?? o?.name ?? '' })) : [];
  }

  private probe(): void {
    if (probeLogged) return;
    probeLogged = true;
    const hc = this.hostComponent ?? {};
    console.warn('[ec] resource-sharing-format: could not set the format. Inspect the host component below.',
      { keys: Object.keys(hc), hostComponent: hc });
  }
}
