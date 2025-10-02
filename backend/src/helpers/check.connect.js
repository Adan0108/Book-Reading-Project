'use strict'
const mongoose = require('mongoose')
const os = require('os')
const process = require('process')

const _SECONDS = 5000
//Count Connect
const countConnect = () => {

  const numConnections = mongoose.connections.length
  console.log(`NUmber of Connection: ${numConnections}.`)
}

//Check overload
const checkOverload = () => {
  setInterval(() => {
    const numConnections = mongoose.connections.length
    const numCores = os.cpus().length;
    const memoryUsage = process.memoryUsage().rss;
    // Example maximum number of connections based on number of cores
    const maxConnection = numCores * 5;
    console.log(`Active Connections: ${numConnections}`)
    console.log(`Memory Usage: ${memoryUsage / 1024 / 1024}MB`)

    if(numConnections > maxConnection){
      console.log('Overload Detected! Attempting to close some connections...')
      //notify.send(....)
    }

  }, _SECONDS) // Monitor every 5 seconds
}


module.exports = {
  countConnect,
  checkOverload
}