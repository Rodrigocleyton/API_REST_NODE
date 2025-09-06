require('dotenv').config()

require('elastic-apm-node').start({
  serviceName: process.env.ELASTIC_APM_SERVICE_NAME,
  secretToken: process.env.APM_SECRET_TOKEN,
  serverUrl: process.env.APM_SERVER_URL,
  environment: process.env.NODE_ENV === 'dev' ? 'development' : 'production',
})

require('express-async-errors')

const express = require('express')
const compression = require('compression')
const { erros } = require('cerebrate')
const swaggerUi = require('swagger-ui-express')

const yaml = require('js-yaml')

const routes = require('./router/index.js')

const jsonParser = express.json()

const { httpContext, setContext } = require('./middlewares/http-context')

const { loggerError } = require('../monitoring/logs/error-logs')
const responseLogger = require('../monitoring/logs/response')
const { requestLogger } = require('../monitoring/logs/request')

const fs = require('fs')

function setupApiDocumentation(app, routePath, yamlFilePath) {
  const fileContents = fs.readFileSync(yamlFilePath, 'utf-8')
  const documentation = yaml.load(fileContents)
  app.use(routePath, swaggerUi.serve, swaggerUi.setup(documentation))
}

const app = express()

app.use(
  compression({
    level: 6,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false
      }
      return compression.filter(req, res)
    },
  }),
)

const documentationFilePath = `${__dirname}/../../../src/shared/presentation/documentation.yaml`
const swaggerFilePath = `${__dirname}/../../../src/shared/presentation/swagger.yaml`

setupApiDocumentation(app, '/api/docs', documentationFilePath)
setupApiDocumentation(app, '/api/swagger', swaggerFilePath)

const { ORIGIN_API } = require('../configs/shared-variables-config.json')

app.use(jsonParser)
app.use(contentType)
app.use(httpContext)
app.use(setContext)

app.use(requestLogger)
app.use(responseLogger())

app.use(routes)

app.use(errors())

process.on('unhandledRejection', (reason, p) => {
  loggerError(`${ORIGIN_API}: Unhandled Rejection`, {
    error: { p, reason: reason.toString() },
  })
})

process.on('Unhandled Rejection', err => {
  loggerError(`${ORIGIN_API}: Uncaught Exception`, {
    error: { error: err.message, stack: err.stack },
  })
})

module.exports = app
