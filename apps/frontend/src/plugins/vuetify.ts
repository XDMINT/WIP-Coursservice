import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { getThemeNameForSystemPreference, LIGHT_THEME_NAME, DARK_THEME_NAME } from '@/services/theme.service'

export default createVuetify({
  components: {},
  theme: {
    defaultTheme: getThemeNameForSystemPreference(),
    themes: {
      [LIGHT_THEME_NAME]: {
        dark: false,
        colors: {
          background: '#F7F9F4',
          surface: '#FFFFFF',
          'surface-variant': '#EEF2E9',
          primary: '#4F7F12',
          secondary: '#176B68',
          error: '#BA1A1A',
          warning: '#8A5700',
          info: '#0B63A5',
          success: '#2E6B1F',
          outline: '#74796E',
          'on-background': '#1A1C18',
          'on-surface': '#1A1C18',
          'on-surface-variant': '#44483F',
          'on-primary': '#FFFFFF',
          'on-secondary': '#FFFFFF',
          'on-error': '#FFFFFF',
          'on-warning': '#FFFFFF',
          'on-info': '#FFFFFF',
          'on-success': '#FFFFFF',
          'primary-dark': '#345900',
          'primary-light': '#C7F36E',
          'surface-muted': '#F0F4EC',
          'status-locked': '#5F6368',
          'status-available': '#4F7F12',
          'status-progress': '#8A5700',
          'status-completed': '#2E6B1F',
          'status-failed': '#BA1A1A'
        }
      },
      [DARK_THEME_NAME]: {
        dark: true,
        colors: {
          background: '#11140F',
          surface: '#1A1D17',
          'surface-variant': '#2E3329',
          primary: '#B6E95D',
          secondary: '#76D1CB',
          error: '#FFB4AB',
          warning: '#F4C36B',
          info: '#9DCAFF',
          success: '#9DD78B',
          outline: '#8E9388',
          'on-background': '#E3E4DA',
          'on-surface': '#E3E4DA',
          'on-surface-variant': '#C5CABD',
          'on-primary': '#233600',
          'on-secondary': '#003735',
          'on-error': '#690005',
          'on-warning': '#462B00',
          'on-info': '#003258',
          'on-success': '#10380A',
          'primary-dark': '#9DD243',
          'primary-light': '#D1FF87',
          'surface-muted': '#23281E',
          'status-locked': '#BEC3B7',
          'status-available': '#B6E95D',
          'status-progress': '#F4C36B',
          'status-completed': '#9DD78B',
          'status-failed': '#FFB4AB'
        }
      }
    }
  }
})
