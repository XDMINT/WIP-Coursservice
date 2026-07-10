import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Components
import App from './App.vue'

// Composables
import router from './router'

// Plugins
import { registerPlugins } from './plugins'
import vuetify from './plugins/vuetify'
import { installSystemColorScheme } from './services/theme.service'

const pinia = createPinia()
const app = createApp(App)
registerPlugins()
installSystemColorScheme(vuetify)

app.use(router)
app.use(vuetify)
app.use(pinia)
app.mount('#app')
