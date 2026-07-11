import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { darkThemeColors, getThemeNameForSystemPreference, lightThemeColors, LIGHT_THEME_NAME, DARK_THEME_NAME } from '@/services/theme.service'

export default createVuetify({
  components: {},
  theme: {
    defaultTheme: getThemeNameForSystemPreference(),
    themes: {
      [LIGHT_THEME_NAME]: {
        dark: false,
        colors: lightThemeColors
      },
      [DARK_THEME_NAME]: {
        dark: true,
        colors: darkThemeColors
      }
    }
  }
})
