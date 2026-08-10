/**
 * Shared coming-soon panel factory for routes whose real view ships in a
 * later phase (D-07). Nav membership stays owned solely by NAV_ORDER
 * (plan 03) — this factory intentionally leaves the nav-registration
 * field unset on the returned view record.
 */

import type { DashboardView, ViewMountContext } from '../view.types.js';
import { STUB_PHASE } from '../view.types.js';

export function createStubView(route: string, viewName: string): DashboardView {
  return {
    route,
    title: viewName,
    mount(ctx: ViewMountContext): void {
      ctx.container.replaceChildren();

      const section = document.createElement('section');
      section.className = 'stub-panel';

      const heading = document.createElement('h1');
      heading.className = 'text-heading';
      heading.textContent = `${viewName} — coming soon`;

      const body = document.createElement('p');
      body.className = 'text-body';
      body.textContent = `This view lands in Phase ${STUB_PHASE[route]}. Browse Activities or check the Overview for now.`;

      section.appendChild(heading);
      section.appendChild(body);
      ctx.container.appendChild(section);
    },
  };
}
