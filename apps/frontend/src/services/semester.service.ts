import { listSemesters } from './mockData'

class SemesterService {
  getAllSemesters() {
    return Promise.resolve(listSemesters())
  }
}

export default new SemesterService()
