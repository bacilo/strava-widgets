/**
 * Top nav bar: brand link, mobile hamburger collapse, the five NAV_ORDER
 * entries, and the light/dark/auto theme toggle (D-05, D-14).
 *
 * Every node is built with `document.createElement`/`createElementNS` +
 * `textContent` — no HTML-string assignment anywhere — establishing the
 * DOM-construction pattern plan 07's athlete free text must also follow
 * (T-16-SH-02).
 * Theming always goes through theme.ts; this file never touches
 * localStorage directly.
 */

import { NAV_ORDER } from './view.types.js';
import {
  applyThemeMode,
  cycleThemeMode,
  readStoredMode,
  watchSystemTheme,
  resolveEffectiveTheme,
  type Theme,
  type ThemeMode,
} from './theme.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvgElement(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  return el;
}

/** Three horizontal bars — the hamburger icon. No icon library, no icon font. */
function buildHamburgerIcon(): SVGElement {
  const svg = createSvgElement('svg', {
    viewBox: '0 0 24 24',
    width: '20',
    height: '20',
    'aria-hidden': 'true',
  });
  for (const y of [5, 11, 17]) {
    svg.appendChild(
      createSvgElement('line', {
        x1: '3',
        y1: String(y),
        x2: '21',
        y2: String(y),
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
      })
    );
  }
  return svg;
}

/** Hand-authored sun icon: a circle plus eight rays. */
function buildSunIcon(): SVGElement {
  const svg = createSvgElement('svg', {
    class: 'theme-toggle__icon theme-toggle__icon--sun',
    viewBox: '0 0 24 24',
    width: '18',
    height: '18',
    'aria-hidden': 'true',
  });
  svg.appendChild(
    createSvgElement('circle', {
      cx: '12',
      cy: '12',
      r: '4',
      fill: 'currentColor',
    })
  );
  const rayPositions: Array<[number, number, number, number]> = [
    [12, 1, 12, 4],
    [12, 20, 12, 23],
    [1, 12, 4, 12],
    [20, 12, 23, 12],
    [4, 4, 6.2, 6.2],
    [17.8, 17.8, 20, 20],
    [4, 20, 6.2, 17.8],
    [17.8, 6.2, 20, 4],
  ];
  for (const [x1, y1, x2, y2] of rayPositions) {
    svg.appendChild(
      createSvgElement('line', {
        x1: String(x1),
        y1: String(y1),
        x2: String(x2),
        y2: String(y2),
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
      })
    );
  }
  return svg;
}

/** Hand-authored moon icon: a crescent built from an offset circle mask path. */
function buildMoonIcon(): SVGElement {
  const svg = createSvgElement('svg', {
    class: 'theme-toggle__icon theme-toggle__icon--moon',
    viewBox: '0 0 24 24',
    width: '18',
    height: '18',
    'aria-hidden': 'true',
  });
  svg.appendChild(
    createSvgElement('path', {
      d: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
      fill: 'currentColor',
    })
  );
  return svg;
}

const THEME_MODE_LABEL: Readonly<Record<ThemeMode, string>> = {
  light: 'Theme: light',
  dark: 'Theme: dark',
  auto: 'Theme: auto',
};

export function createNav(root: HTMLElement): { setActiveRoute(route: string): void; destroy(): void } {
  const navEl = document.createElement('nav');
  navEl.className = 'app-nav';
  navEl.setAttribute('data-open', 'false');

  const brand = document.createElement('a');
  brand.className = 'app-nav__brand';
  brand.href = '#/';
  brand.textContent = 'Training Dashboard';

  const linksId = 'app-nav-links';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'app-nav__toggle';
  toggleBtn.setAttribute('aria-label', 'Toggle navigation');
  toggleBtn.setAttribute('aria-expanded', 'false');
  toggleBtn.setAttribute('aria-controls', linksId);
  toggleBtn.appendChild(buildHamburgerIcon());

  const linksEl = document.createElement('ul');
  linksEl.className = 'app-nav__links';
  linksEl.id = linksId;

  const linkByRoute = new Map<string, HTMLAnchorElement>();
  const orderedEntries = [...NAV_ORDER].sort((a, b) => a.order - b.order);
  for (const entry of orderedEntries) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'app-nav__link';
    link.href = '#' + entry.route;
    link.textContent = entry.label;
    li.appendChild(link);
    linksEl.appendChild(li);
    linkByRoute.set(entry.route, link);
  }

  const sunIcon = buildSunIcon();
  const moonIcon = buildMoonIcon();

  const themeToggleBtn = document.createElement('button');
  themeToggleBtn.type = 'button';
  themeToggleBtn.className = 'theme-toggle';
  themeToggleBtn.appendChild(sunIcon);
  themeToggleBtn.appendChild(moonIcon);

  navEl.appendChild(brand);
  navEl.appendChild(toggleBtn);
  navEl.appendChild(linksEl);
  navEl.appendChild(themeToggleBtn);
  root.appendChild(navEl);

  function updateThemeToggle(mode: ThemeMode, prefersDark?: boolean): void {
    themeToggleBtn.setAttribute('aria-label', THEME_MODE_LABEL[mode]);
    const dark =
      prefersDark ?? window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effective: Theme = resolveEffectiveTheme(mode, dark);
    sunIcon.classList.toggle('theme-toggle__icon--active', effective === 'light');
    moonIcon.classList.toggle('theme-toggle__icon--active', effective === 'dark');
  }

  updateThemeToggle(readStoredMode(localStorage));

  function handleToggleClick(): void {
    const isOpen = navEl.getAttribute('data-open') === 'true';
    const next = !isOpen;
    navEl.setAttribute('data-open', String(next));
    toggleBtn.setAttribute('aria-expanded', String(next));
  }
  toggleBtn.addEventListener('click', handleToggleClick);

  function handleLinksClick(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('a.app-nav__link')) {
      navEl.setAttribute('data-open', 'false');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
  }
  linksEl.addEventListener('click', handleLinksClick);

  function handleThemeToggleClick(): void {
    const current = readStoredMode(localStorage);
    const next = cycleThemeMode(current);
    applyThemeMode(next);
    updateThemeToggle(next);
  }
  themeToggleBtn.addEventListener('click', handleThemeToggleClick);

  const unsubscribeSystemTheme = watchSystemTheme((prefersDark) => {
    applyThemeMode('auto', { prefersDark });
    updateThemeToggle('auto', prefersDark);
  });

  function setActiveRoute(route: string): void {
    for (const [linkRoute, link] of linkByRoute) {
      if (linkRoute === route) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    }
  }

  function destroy(): void {
    unsubscribeSystemTheme();
    toggleBtn.removeEventListener('click', handleToggleClick);
    linksEl.removeEventListener('click', handleLinksClick);
    themeToggleBtn.removeEventListener('click', handleThemeToggleClick);
    navEl.remove();
  }

  return { setActiveRoute, destroy };
}
