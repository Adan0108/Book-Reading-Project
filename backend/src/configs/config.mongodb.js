'use strict'

//level 0

// const config = {
//   app: {
//     port:3000
//   },
//   db:{
//     host: 'localhost',
//     port: 27017,
//     dbName: 'db'
//   }
// }

//level 1

const dev = {
  app: {
    port: process.env.DEV_APP_PORT || 3052,
  },
  db:{
    host: process.env.HOST || 'localhost',
    port: process.env.DEV_DB_PORT || 27017,
    name: process.env.DEV_DB_NAME || 'E-CommerceDev'
  }
}

const pro = {
  app: {
    port:process.env.PRO_APP_PORT || 3000,
  },
  db:{
    host: process.env.PRO_DB_HOST || 'localhost' , // || is used to provide a default value if the environment variable is not set,
    port: process.env.PRO_DB_PORT || 27017,
    name: process.env.PRO_DB_NAME || 'E-CommercePro'
  }
}

const config = {dev,pro}
const env = process.env.NODE_ENV || 'dev'

console.log(config[env],env)

module.exports = config[`dev`]