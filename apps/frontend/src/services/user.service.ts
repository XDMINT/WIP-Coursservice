class UserService {
  getPublicContent() {
    return Promise.resolve({ data: 'Dies ist ein lokaler Demo-Startpunkt ohne Backend. Ersetze diese Daten später durch echte Services.' })
  }

  getUserBoard() {
    return Promise.resolve({ data: 'Lokale Demo-Nutzeransicht' })
  }
}

export default new UserService()
