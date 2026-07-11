export const LIGHT_THEME_NAME = 'ewillLight'
export const DARK_THEME_NAME = 'ewillDark'
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

export const lightThemeColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  'surface-variant': '#F2F4F7',
  primary: '#4F7F12',
  secondary: '#176B68',
  error: '#BA1A1A',
  warning: '#8A5700',
  info: '#0B63A5',
  success: '#2E6B1F',
  outline: '#74777F',
  'on-background': '#1B1B1F',
  'on-surface': '#1B1B1F',
  'on-surface-variant': '#44474F',
  'on-primary': '#FFFFFF',
  'on-secondary': '#FFFFFF',
  'on-error': '#FFFFFF',
  'on-warning': '#FFFFFF',
  'on-info': '#FFFFFF',
  'on-success': '#FFFFFF',
  'primary-dark': '#345900',
  'primary-light': '#C7F36E',
  'surface-muted': '#F6F7F9',
  'status-locked': '#5F6368',
  'status-available': '#4F7F12',
  'status-progress': '#8A5700',
  'status-completed': '#2E6B1F',
  'status-failed': '#BA1A1A'
}

export const darkThemeColors = {
  background: '#0B0B0D',
  surface: '#181A1B',
  'surface-variant': '#26282B',
  primary: '#B6E95D',
  secondary: '#76D1CB',
  error: '#FFB4AB',
  warning: '#F4C36B',
  info: '#9DCAFF',
  success: '#9DD78B',
  outline: '#8F9298',
  'on-background': '#E5E5E8',
  'on-surface': '#E5E5E8',
  'on-surface-variant': '#C7C7CC',
  'on-primary': '#233600',
  'on-secondary': '#003735',
  'on-error': '#690005',
  'on-warning': '#462B00',
  'on-info': '#003258',
  'on-success': '#10380A',
  'primary-dark': '#9DD243',
  'primary-light': '#D1FF87',
  'surface-muted': '#202124',
  'status-locked': '#BDC1C6',
  'status-available': '#B6E95D',
  'status-progress': '#F4C36B',
  'status-completed': '#9DD78B',
  'status-failed': '#FFB4AB'
}

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
