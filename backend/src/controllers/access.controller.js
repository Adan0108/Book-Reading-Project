'use strict'
const AccessService = require('../services/access.service')

const { OK , CREATED , SuccessResponse} = require('../core/success.response')
const { BadRequestError } = require('../core/error.response')
/*
200 OK
201 CREATED
*/
class AccessController {

  handlerRefreshToken = async (req, res, next) => {
    //V1
    // new SuccessResponse({
    //   message: 'Get Token Success!',
    //   metadata : await AccessService.handlerRefreshToken( req.body.refreshToken )
    // }).send(res)

    //V2 Fixed = no need access token
      new SuccessResponse({
        message: 'Get Token Success!',
        metadata : await AccessService.handlerRefreshTokenV2( { 
          refreshToken : req.refreshToken,
          user : req.user,
          keyStore : req.keyStore
        } )
      }).send(res)

  }

  logout = async (req, res, next) => {
    new SuccessResponse({
      message: 'Logout Success!',
      metadata : await AccessService.logout( req.keyStore )
    }).send(res)
  }

  login = async (req, res, next) => {
    new SuccessResponse({
      metadata : await AccessService.login( req.body )
    }).send(res)
  }

  signUp = async (req, res, next) => {
    // try {
      // console.log(`[P]::signUp::`, req.body)
      // return res.status(201).json(
      //   await AccessService.signUp(req.body)
      // )
    // } catch (error) {
    //   next(error)
    // }
    new CREATED({
      message: 'RegisterOK!',
      metadata: await AccessService.signUp(req.body),
      options:{
        limit: 10
      }
    }).send(res)
  }
}
module.exports = new AccessController();