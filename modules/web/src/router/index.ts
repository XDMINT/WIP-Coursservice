import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/ViewHome.vue'
import ViewImpressum from '../views/ViewImpressum.vue'
import ViewDatenschutz from '../views/ViewDatenschutz.vue'
import ViewLogin from '../views/ViewLogin.vue'
import ViewProfile from '../views/ViewProfile.vue'
import ViewCourses from '../views/ViewCourses.vue'
import ViewCourseSignup from '../views/ViewCourseSignup.vue'
import ViewCourse from '../views/ViewCourse.vue'
import ViewIntroduction from '../views/ViewIntroduction.vue'
import View404Page from '../views/View404Page.vue'
import ViewMembers from '../views/ViewMembers.vue'

import authService from '@/services/auth.service'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/home',
      name: 'Home',
      component: HomeView
    },
    {
      path: '/impressum',
      name: 'ViewImpressum',
      component: ViewImpressum
    },
    {
      path: '/datenschutz',
      name: 'ViewDatenschutz',
      component: ViewDatenschutz
    },
    {
      path: '/login',
      name: 'ViewLogin',
      component: ViewLogin
    },
    {
      path: '/profile',
      name: 'ViewProfile',
      component: ViewProfile
    },
    {
      path: '/course',
      name: 'ViewCourses',
      component: ViewCourses
    },
    {
      path: '/course/:id/signup',
      name: 'ViewCourseSignup',
      component: ViewCourseSignup
    },
    {
      path: '/course/:id',
      name: 'ViewCourse',
      component: ViewCourse
    },
    {
      path: '/',
      name: 'ViewIntroduction',
      component: ViewIntroduction
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'View404Page',
      component: View404Page
    },
    {
      path: '/course/:courseId/members',
      name: 'ViewMembers',
      component: ViewMembers
    }
  ]
})

router.beforeEach(async (to, from, next) => {
  const publicPages = ['/login']
  const authRequired = !publicPages.includes(to.path)
  const loggedIn = localStorage.getItem('user')

  const loginValid = await authService.isValid().then((response) => {
    if (response === true) {
      return true
    } else {
      localStorage.removeItem('user')
      return false
    }
  })

  // trying to access a restricted page + not logged in
  // redirect to login page
  if ((authRequired && !loggedIn) || (authRequired && !loginValid)) {
    next('/login')
  } else {
    next()
  }
})

export default router
