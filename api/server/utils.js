import _ from 'lodash'
import jsyaml from 'js-yaml'
import iso from './iso'

export class TaskQueue {
  constructor (concurrency) {
    this.concurrency = concurrency
    this.running = 0
    this.queue = []
  }

  pushTask (task) {
    this.queue.push(task)
    this.next()
  }

  next () {
    while(this.running < this.concurrency && this.queue.length) {
      const task = this.queue.shift()
      task().then(() => {
        this.running--
        this.next()
      })
      this.running++
    }
  }
}

export function getCollectionFiles (schemaArray, filesArray) {
  filesArray.forEach(item => {
    if (/^[^_]+\w*\.html$/i.test(item.path)) {
      // any html files that are not in folders starts with '_' are pages file
      item.collectionType = 'pages' 
    } else if ((item.type === 'blob') &&
      /\.(html|md|markdown)$/i.test(item.path) &&
      (item.size <3000000)) {
      // map collection type for files defined in schema
      _.forEach(schemaArray, s => {
        if (item.path.indexOf(s.jekyll.dir) === 0) {
          item.collectionType = s.jekyll.id
          return false
        }
      })
    }
  })
  return filesArray.filter(item => {
    return !!item.collectionType
  })
  .map(i => {
    return _.pick(i, ['path', 'collectionType'])
  })
}

export function getLangFromConfigYaml (content) {
  var config = jsyaml.safeLoad(content)
  var lanArray = config['lang']
    
  if (lanArray) {
    let cmsConfig = {}
    cmsConfig['languages'] = lanArray.map((lanCode) => {
      return {
        'name': iso[lanCode] || lanCode,
        'code': lanCode
      }
    })
    return cmsConfig
  }
  return null
}