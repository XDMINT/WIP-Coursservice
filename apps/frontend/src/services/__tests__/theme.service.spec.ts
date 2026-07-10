import { describe, expect, it, vi } from 'vitest'

import { COLOR_SCHEME_QUERY, DARK_THEME_NAME, LIGHT_THEME_NAME, getThemeNameForSystemPreference, installSystemColorScheme } from '../theme.service'

const createThemeTarget = () => ({
  theme: {
    global: {
      name: {
        value: ''
      }
    }
  }
})

const createMatchMediaWindow = (initialMatches: boolean) => {
  let changeListener: ((event: { matches: boolean }) => void) | undefined
  const mediaQuery = {
    addEventListener: vi.fn((_event: string, listener: (event: { matches: boolean }) => void) => {
      changeListener = listener
    }),
    addListener: vi.fn(),
    matches: initialMatches,
    removeEventListener: vi.fn(),
    removeListener: vi.fn()
  }
  const targetWindow = {
    matchMedia: vi.fn(() => mediaQuery)
  }

  return {
    mediaQuery,
    targetWindow,
    updateMatches: (matches: boolean) => {
      mediaQuery.matches = matches
      changeListener?.({ matches })
    }
  }
}

describe('theme.service', () => {
  it('activates light mode for a light system preference', () => {
    const { targetWindow } = createMatchMediaWindow(false)
    const target = createThemeTarget()

    installSystemColorScheme(target, targetWindow as any)

    expect(targetWindow.matchMedia).toHaveBeenCalledWith(COLOR_SCHEME_QUERY)
    expect(target.theme.global.name.value).toBe(LIGHT_THEME_NAME)
  })

  it('activates dark mode for a dark system preference', () => {
    const { targetWindow } = createMatchMediaWindow(true)
    const target = createThemeTarget()

    installSystemColorScheme(target, targetWindow as any)

    expect(target.theme.global.name.value).toBe(DARK_THEME_NAME)
  })

  it('updates the active theme when the system preference changes', () => {
    const { targetWindow, updateMatches } = createMatchMediaWindow(false)
    const target = createThemeTarget()

    installSystemColorScheme(target, targetWindow as any)
    updateMatches(true)

    expect(target.theme.global.name.value).toBe(DARK_THEME_NAME)
  })

  it('falls back to light mode without window or matchMedia', () => {
    const target = createThemeTarget()

    expect(() => installSystemColorScheme(target, undefined)).not.toThrow()
    expect(getThemeNameForSystemPreference(undefined)).toBe(LIGHT_THEME_NAME)
    expect(target.theme.global.name.value).toBe(LIGHT_THEME_NAME)
  })
})
