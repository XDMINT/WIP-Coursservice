import { createDemoUserFromUsername } from './mockData'
import type User from '@/model/User'

class AuthService {
  login(user: { username: string; password: string }): Promise<User> {
    return new Promise<User>((resolve, reject) => {
      if (!user.username || !user.password) {
        reject(new Error('Username and password are required'))
        return
      }

      const demoUser = createDemoUserFromUsername(user.username)
      localStorage.setItem('user', JSON.stringify(demoUser))
      localStorage.setItem('role', demoUser.roles.join(','))
      resolve(demoUser)
    })
  }

  tokenLogin(this_jsessionid: string): Promise<User> {
    return new Promise<User>((resolve) => {
      const tokenUser = createDemoUserFromUsername(`token-${this_jsessionid.slice(0, 8)}`)
      const authenticatedUser = {
        ...tokenUser,
        token: this_jsessionid
      }

      localStorage.setItem('user', JSON.stringify(authenticatedUser))
      localStorage.setItem('role', authenticatedUser.roles.join(','))
      resolve(authenticatedUser)
    })
  }

  logout() {
    localStorage.removeItem('user')
    console.log('logout successful')
  }

  isValid() {
    return Promise.resolve(localStorage.getItem('user') != null)
  }
}

export default new AuthService()
