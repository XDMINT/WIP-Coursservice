export const LIGHT_THEME_NAME = 'ewillLight'
export const DARK_THEME_NAME = 'ewillDark'
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

type ThemeControllerTarget = {
  theme?: {
    global?: {
      name?: {
        value: string
      }
    }
  }
}

type ThemeWindow = Pick<Window, 'matchMedia'>

const resolveWindow = (): ThemeWindow | undefined => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return undefined
  }

  return window
}

export const getThemeNameForSystemPreference = (targetWindow = resolveWindow()) => {
  if (!targetWindow) {
    return LIGHT_THEME_NAME
  }

  return targetWindow.matchMedia(COLOR_SCHEME_QUERY).matches ? DARK_THEME_NAME : LIGHT_THEME_NAME
}

export const setVuetifyThemeName = (vuetify: ThemeControllerTarget, themeName: string) => {
  const themeNameRef = vuetify.theme?.global?.name

  if (themeNameRef) {
    themeNameRef.value = themeName
  }
}

export const installSystemColorScheme = (vuetify: ThemeControllerTarget, targetWindow = resolveWindow()) => {
  if (!targetWindow) {
    setVuetifyThemeName(vuetify, LIGHT_THEME_NAME)
    return () => undefined
  }

  const mediaQuery = targetWindow.matchMedia(COLOR_SCHEME_QUERY)
  const applyTheme = () => {
    setVuetifyThemeName(vuetify, mediaQuery.matches ? DARK_THEME_NAME : LIGHT_THEME_NAME)
  }

  applyTheme()

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', applyTheme)
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }

  mediaQuery.addListener?.(applyTheme)
  return () => mediaQuery.removeListener?.(applyTheme)
}
