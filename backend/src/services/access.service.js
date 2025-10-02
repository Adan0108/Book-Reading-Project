'use strict'

const shopModel = require("../models/shop.model");
const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const keyTokenService = require("./keyToken.service");
const { createTokenPair, verifyJWT } = require("../auth/authUtils");
const { getInfoData } = require("../utils");
const { BadRequestError, ConflictRequestError, AuthFailureError, ForbiddenError } = require("../core/error.response");

const { findByEmail } = require('./shop.service')

const RoleShop = {
  SHOP: 'SHOP',
  WRITER: '00001', //this code is use for writer role but we only show client the code for secure
  EDITOR: '00002',
  ADMIN: '00003',
}

class AccessService {

  /*
  Check this token used?
   */
  //V1
  // static handlerRefreshToken = async (refreshToken) => {

  //   //check xem token nay da duoc su dung chua?
  //   const foundToken = await keyTokenService.findByRefreshTokenUsed(refreshToken)
  //   if (foundToken) {
  //     //decode to see who user is this ?
  //     const { userId, email } = await verifyJWT(refreshToken, foundToken.privateKey);
  //     console.log({ userId, email })

  //     //delete
  //     //xoa tat ca token trong keyStore
  //     await keyTokenService.deleteKeyById(userId)
  //     throw new ForbiddenError('Something Wrong Happend !! Please relogin')
  //   }

  //   //No
  //   const holderToken = await keyTokenService.findByRefreshToken( refreshToken )
  //   if (!holderToken) throw new AuthFailureError('Shop not registered 1')

  //   //verify token
  //   const { userId, email } = await verifyJWT(refreshToken, holderToken.privateKey);
  //   console.log('[2]--',{ userId, email })
  //   //check UserId
  //   const foundShop = await findByEmail({ email })
  //   if (!foundShop) throw new AuthFailureError('Shop not registered 2')

  //   //create 1 cap moi
  //   const tokens = await createTokenPair({userId, email}, holderToken.publicKey, holderToken.privateKey)

  //   //update token
  //   await holderToken.updateOne({
  //     $set:{
  //       refreshToken : tokens.refreshToken,
  //     },
  //     $addToSet: {
  //       refreshTokensUsed: refreshToken, //da duoc su dung de lay token moi roi
  //     }
  //   })

  //   return {
  //     user: { userId, email },
  //     tokens
  //   }

  // }

  //V2
    static handlerRefreshTokenV2 = async ({keyStore , user, refreshToken}) => {
      const { userId , email } = user;

      if(keyStore.refreshTokensUsed.includes(refreshToken)){
        await keyTokenService.deleteKeyById(userId)
        throw new ForbiddenError(' Something Wrong happended !! Please relogin')
      }

      if(keyStore.refreshToken !== refreshToken) throw new AuthFailureError('Shop not register')
      
      const foundShop = await findByEmail({ email })
      if (!foundShop) throw new AuthFailureError('Shop not registered 2')

      //create 1 cap moi
      const tokens = await createTokenPair({userId, email}, keyStore.publicKey, keyStore.privateKey)

      //update token
      await keyStore.updateOne({
        $set:{
          refreshToken : tokens.refreshToken,
        },
        $addToSet: {
          refreshTokensUsed: refreshToken, //da duoc su dung de lay token moi roi
        }
      })

      return {
        user,
        tokens
      }

  }

  static logout = async (keyStore) => {
    const delKey = await keyTokenService.removeKeyById(keyStore._id)
    console.log({ delKey })
    return delKey
  }

  /* Login
   1- Check email in dbs
   2- Match password
   3 - Create AT and RT and save
   4 - Generate tokens
   5 - Get data return login
  */
  static login = async ({ email, password, refreshToken = null }) => {
    //1
    const foundShop = await findByEmail({ email })
    if (!foundShop) {
      throw new BadRequestError('Shop not register')
    }
    //2
    const match = await bcrypt.compare(password, foundShop.password);
    if (!match) {
      throw new AuthFailureError('Authentication failed')
    }
    //3 create private and public key
    const privateKey = crypto.randomBytes(64).toString('hex')
    const publicKey = crypto.randomBytes(64).toString('hex')
    //4 create token
    const { _id: userId } = foundShop
    const tokens = await createTokenPair({
      userId,
      email
    }, publicKey, privateKey)
    await keyTokenService.createKeyToken({
      refreshToken: tokens.refreshToken,
      privateKey, publicKey,
      userId
    })
    return {
      shop: getInfoData({ fileds: ['_id', 'name', 'email'], object: foundShop }),
      tokens
    }


  }

  static signUp = async ({ name, email, password }) => {
    try {
      //step 1 :check if email already exists ( use lean for java opject to reduce the size and time)
      const holderShop = await shopModel.findOne({ email }).lean();

      if (holderShop) {

        throw new BadRequestError('Email already exists')

      }
      const passwordHash = await bcrypt.hash(password, 10);
      const newShop = await shopModel.create({
        name, email, password: passwordHash, roles: [RoleShop.SHOP]
      })

      if (newShop) {
        // create privateKey , publicKey : Private key use for client to sign the token, publicKey use for server to verify the token


        //Public key CryptoFraphy Standard 1

        //we use this simple techinique for this project Instead
        const privateKey = crypto.randomBytes(64).toString('hex')
        const publicKey = crypto.randomBytes(64).toString('hex')


        console.log({ privateKey, publicKey }) //save collection KeyStore

        const keyStore = await keyTokenService.createKeyToken({
          userId: newShop._id,
          publicKey,
          privateKey
        })

        if (!keyStore) {
          return {
            code: 'xxxx',
            message: 'keyStore error'
          }
        }
        // create token pair
        const tokens = await createTokenPair({
          userId: newShop._id,
          email
        }, publicKey, privateKey)

        console.log(`Create Token Success ::`, tokens) // save collection TokenPair

        return {
          code: 201,
          metadata: {
            shop: getInfoData({ fileds: ['_id', 'name', 'email'], object: newShop }),
            tokens
          }
        }
      }
      return {
        code: 200,
        metadata: null
      }
    } catch (error) {
      return {
        code: 'xxx',
        message: error.message,
        status: 'error'
      }
    }
  }

}

module.exports = AccessService;