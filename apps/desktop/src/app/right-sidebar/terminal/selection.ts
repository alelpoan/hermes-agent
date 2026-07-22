import type { ITheme, Terminal } from '@xterm/xterm'
import type { CSSProperties } from 'react'

import type { DesktopTerminalPalette } from '@/themes/types'

// VS Code's default integrated-terminal palette (terminalColorRegistry.ts) — a
// fixed table per theme type, not luminance-derived. Light/dark diverge on
// purpose so each stays legible (e.g. mustard yellow on white).
const DARK_THEME: ITheme = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#cccccc',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f7866',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5'
}

const LIGHT_THEME: ITheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#333333',
  cursorAccent: '#ffffff',
  selectionBackground: '#add6ff80',
  black: '#000000',
  red: '#cd3131',
  green: '#00bc00',
  yellow: '#949800',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#14ce14',
  brightYellow: '#b5ba00',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#a5a5a5'
}

// Palette by painted mode, optionally overlaid with an imported theme's ANSI
// palette (Solarized terminal for the Solarized skin, etc.). `palette` only
// fills the slots it defines, so a partial import keeps the mode defaults for
// the rest. `background` is a fallback only — withSurface swaps in the live skin
// surface at runtime (keeping transparency); minimumContrastRatio keeps colors
// crisp against it.
export function terminalTheme(mode: 'light' | 'dark', palette?: DesktopTerminalPalette): ITheme {
  const base = mode === 'dark' ? DARK_THEME : LIGHT_THEME

  if (!palette) {
    return base
  }

  const overlay = { ...base } as Record<string, string>

  for (const [slot, value] of Object.entries(palette)) {
    if (value) {
      overlay[slot] = value
    }
  }

  return overlay as ITheme
}

// Resolve --ui-editor-surface-background (a color-mix on the skin seed) to a
// concrete rgb for the WebGL renderer + contrast clamp. Custom props don't
// resolve via getComputedStyle, so probe a real background-color. Read AFTER
// applyTheme repaints (mount / rAF post-change) or it lags a frame behind.
export function resolveSurfaceColor(fallback: string): string {
  if (typeof document === 'undefined' || !document.body) {
    return fallback
  }

  const probe = document.createElement('span')
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;background-color:var(--ui-editor-surface-background)'
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).backgroundColor
  probe.remove()

  return resolved && resolved !== 'rgba(0, 0, 0, 0)' ? resolved : fallback
}

// Resolve --dt-midground the same way resolveSurfaceColor resolves the editor
// surface, then derive the three xterm scrollbar-slider states at the same
// alpha steps as .scrollbar-dt in styles.css (18% / 40% / 50%), so the
// terminal's built-in (non-CSS) scrollbar matches the rest of the app.
export function resolveScrollbarTheme(): Pick<
  ITheme,
  'scrollbarSliderActiveBackground' | 'scrollbarSliderBackground' | 'scrollbarSliderHoverBackground'
> {
  if (typeof document === 'undefined' || !document.body) {
    return {}
  }

  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;color:var(--dt-midground)'
  document.body.appendChild(probe)
  const midground = getComputedStyle(probe).color
  probe.remove()

  if (!midground) {
    return {}
  }

  const withAlpha = (alpha: number) => midground.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)

  return {
    scrollbarSliderBackground: withAlpha(0.18),
    scrollbarSliderHoverBackground: withAlpha(0.4),
    scrollbarSliderActiveBackground: withAlpha(0.5)
  }
}

// xterm's Viewport passes `overviewRuler.width` straight through as
// `verticalScrollbarSize` (confirmed in xterm's Viewport._getChangeOptions:
// `verticalScrollbarSize: this._optionsService.rawOptions.overviewRuler?.width || 14`).
// That's a raw pixel value inside the DOM, so it scales with Electron's page
// zoom (UI Scale) like everything else on the page. Native ::-webkit-scrollbar
// thumbs, by contrast, render at a roughly fixed physical thickness regardless
// of page zoom (an accessibility convention in Chromium). 8 is the value
// calibrated to visually match .scrollbar-dt's 8px track at 100% zoom — divide
// out the zoom factor so the *visual* track size stays ~8px (and the slider's
// resulting fill stays ~6px after the CSS border-cut) at every UI Scale preset,
// not just 100%.
export function resolveScrollbarTrackWidth(zoomPercent: number): number {
  const zoomFactor = Math.max(zoomPercent, 1) / 100

  return 8 / zoomFactor
}

export const isMacPlatform = () => navigator.platform.toLowerCase().includes('mac')

export function isAddSelectionShortcut(event: KeyboardEvent) {
  const mod = isMacPlatform() ? event.metaKey : event.ctrlKey

  return mod && !event.shiftKey && event.key.toLowerCase() === 'l'
}

export function terminalSelectionLabel(term: Terminal, shellName: string, text: string) {
  const pos = term.getSelectionPosition()

  if (pos) {
    return pos.start.y === pos.end.y ? `${shellName}:${pos.start.y}` : `${shellName}:${pos.start.y}-${pos.end.y}`
  }

  const lines = Math.max(1, text.trim().split(/\r?\n/).length)

  return `${shellName}:${lines} line${lines === 1 ? '' : 's'}`
}

export function terminalSelectionAnchor(host: HTMLDivElement): CSSProperties | null {
  const rect = Array.from(host.querySelectorAll<HTMLElement>('.xterm-selection div'))
    .map(node => node.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0)
    .at(-1)

  if (!rect) {
    return null
  }

  const hostRect = host.getBoundingClientRect()
  const buttonWidth = 128
  const left = Math.min(Math.max(rect.left - hostRect.left, 8), Math.max(8, host.clientWidth - buttonWidth - 8))
  const top = Math.min(Math.max(rect.bottom - hostRect.top + 4, 8), Math.max(8, host.clientHeight - 34))

  return { left, top }
}
