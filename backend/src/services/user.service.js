'use strict'

const { createTokenPair } = require('../auth/authUtils');
const { BadRequestError } = require('../core/error.response');
const { SuccessResponse } = require('../core/success.response');
const { createUser } = require('../models/repositories/user.repo');
const roleModel = require('../models/role.model');
const User = require('../models/user.model');
const { getInfoData, convertToObjectIdMongodb } = require('../utils');
const { sendEmailToken } = require('./email.service');
const keyTokenService = require('./keyToken.service');
const { checkEmailToken } = require('./otp.service');
const crypto = require('crypto')
const bcrypt = require('bcrypt')

const newUserService = async({
  email = null,
  captcha = null,

}) =>{
  // 1. check email exists in dbs
  const user = await User.findOne({ email }).lean();

  // 2. If email exist 
  if (user) {
    return BadRequestError('Email is already registered');
  }

  // 3. Send token via email user
  const result = await sendEmailToken({email})
  console.log("➡️ Reached sendEMailLinkVerify for:", email);

  return {
    message : 'verify email user',
    metadata : {
      token : result
    }
  }
}

const checkLoginEmailTokenService = async({
  token
}) =>{
  try {
    //1. check token in mode otp
    const {otp_email : email , otp_token} = await checkEmailToken({token})
    if(!email) throw new BadRequestError('Token not found')

    //2. Check email exist in user model
    const hasUser = await findUserByEmailWithLogin({
      email
    })
    if(hasUser) throw new BadRequestError('Email already exist')
      /*
      usr_id: { type: Number, required: true},
      usr_slug: { type: String, required: true},
      usr_name: { type: String, default: ''},
      usr_password: { type: String, default: ''},
      usr_salf: { type: String, default: ''},
      usr_email: { type: String,required: true},
      usr_phone: { type: String, default: ''},
      usr_sex: { type: String, default: ''},
      usr_avatar: { type: String, default: ''},
      usr_date_of_birth: { type: Date, default: null},
      usr_role: { type: Schema.Types.ObjectId, ref: 'Role'},
      usr_status: { type: String, default: 'pending' , enum: ['pending', 'active', 'block']}
     */
    //new user
    const passwordHash = await bcrypt.hash(email, 10);

    const defaultRole = await roleModel.findOne({ rol_name: 'user' }).lean();
    if (!defaultRole) throw new BadRequestError('Default role not found');
    const newUser = await createUser({
      usr_id: 1,
      usr_slug: 'abcxyz',
      usr_name: email,
      usr_password: passwordHash,
      usr_email: email,
      usr_role: defaultRole._id,
    })

    if (newUser) {
      // create privateKey , publicKey : Private key use for client to sign the token, publicKey use for server to verify the token

      //Public key CryptoFraphy Standard 1

      //we use this simple techinique for this project Instead
      const privateKey = crypto.randomBytes(64).toString('hex')
      const publicKey = crypto.randomBytes(64).toString('hex')

      const keyStore = await keyTokenService.createKeyToken({
        userId: newUser.usr_id,
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
        userId: newUser.usr_id,
        email
      }, publicKey, privateKey)

      return {
        code: 201,
        message: 'verify token sucessfully',
        metadata: {
          user: getInfoData({ fileds: ['usr_id', 'usr_name', 'usr_email'], object: newUser }),
          tokens
        }
      }
    }
    
  } catch (error) {
    throw new BadRequestError(error.message || 'Something went wrong');
  }
}

const findUserByEmailWithLogin = async({email}) => {
  const user = await User.findOne({ usr_email : email}).lean()
  return user
}

module.exports = {
  newUserService,
  checkLoginEmailTokenService
}