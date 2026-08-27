/**
 * Curation controls for the Best Efforts panel (Phase 24, D-08).
 *
 * Developer-only, localhost-only — never built by the publish pipeline,
 * never shipped. This is a placeholder: `mountCurationControls` appends a
 * single stub `<div class="curate-controls">` for now. Plan 24-07 replaces
 * the body of this function with the real two-step-commit UI (tick to
 * reveal a required reason textarea and Save button; unticking confirms
 * before deleting the stored entry).
 *
 * OD-3: ships zero CSS. Phase 19's bare-element baseline in
 * src/dashboard/styles.css already covers plain input/textarea/button
 * elements, so this file must never import a stylesheet, create a <style>
 * element, or set an inline `style` attribute on an interactive element.
 * DOM is built with document.createElement + textContent + appendChild only
 * — no HTML-string assignment — matching detail-sections.ts's idiom.
 */

/**
 * Mounts the curation controls for `activityId` into `section`.
 *
 * @param section the Best Efforts <section data-activity-id="..."> to augment
 * @param activityId the activity id the controls apply to
 */
// activityId is unused by this placeholder; plan 24-07's real implementation
// reads/writes against it via the /__curate/exclusions/:id write endpoint
// (plan 24-06).
export function mountCurationControls(section: HTMLElement, activityId: string): void {
  const container = document.createElement('div');
  container.className = 'curate-controls';

  const placeholder = document.createElement('p');
  placeholder.textContent = 'Curation controls load in plan 24-07.';
  container.appendChild(placeholder);

  section.appendChild(container);
}
