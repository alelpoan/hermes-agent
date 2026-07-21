// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveScrollbarTheme } from './selection'

function mockCanvasRoundTrip(rgb: [number, number, number]) {
  const ctx = {
    fillStyle: '',
    fillRect: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray([rgb[0], rgb[1], rgb[2], 255])
    }))
  }

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)

  return ctx
}

function mockProbedColor(color: string) {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ color } as CSSStyleDeclaration)
}

describe('resolveScrollbarTheme', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('derives the three slider states at 18/40/50% alpha from the resolved midground color', () => {
    mockProbedColor('rgb(120, 130, 140)')
    mockCanvasRoundTrip([120, 130, 140])

    expect(resolveScrollbarTheme()).toEqual({
      scrollbarSliderBackground: 'rgba(120, 130, 140, 0.18)',
      scrollbarSliderHoverBackground: 'rgba(120, 130, 140, 0.4)',
      scrollbarSliderActiveBackground: 'rgba(120, 130, 140, 0.5)'
    })
  })

  // Regression guard for the bug this function was rewritten to fix: modern
  // Chromium can serialize a resolved color in syntaxes (e.g. `color(srgb ...)`)
  // that contain no literal "rgb(" substring. A naive `.replace('rgb(', 'rgba(')`
  // silently no-ops on that input, xterm's own color parser then fails to match
  // it and falls back to its default tint. The canvas round-trip must normalize
  // the color correctly regardless of the source serialization syntax.
  it('normalizes a non-"rgb(...)" color serialization via the canvas round-trip', () => {
    mockProbedColor('color(srgb 0.47 0.51 0.55)')
    mockCanvasRoundTrip([120, 130, 140])

    expect(resolveScrollbarTheme().scrollbarSliderBackground).toBe('rgba(120, 130, 140, 0.18)')
  })

  it('returns an empty object when a 2d canvas context is unavailable', () => {
    mockProbedColor('rgb(120, 130, 140)')
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    expect(resolveScrollbarTheme()).toEqual({})
  })

  it('returns an empty object when the probed color resolves to an empty string', () => {
    mockProbedColor('')
    mockCanvasRoundTrip([0, 0, 0])

    expect(resolveScrollbarTheme()).toEqual({})
  })

  it('cleans up the probe element it appends to the body', () => {
    mockProbedColor('rgb(1, 2, 3)')
    mockCanvasRoundTrip([1, 2, 3])

    const before = document.body.childElementCount

    resolveScrollbarTheme()

    expect(document.body.childElementCount).toBe(before)
  })
})
