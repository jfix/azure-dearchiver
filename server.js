'use strict';
const bodyParser = require('body-parser')
require('dotenv').config({path: './_env'})
const express = require('express')
const ipfilter = require('express-ipfilter').IpFilter;
const IpDeniedError = require('express-ipfilter').IpDeniedError;
const path = require('path')
const request = require('request')

const url = `https://${process.env.AZURE_STORAGEACCOUNT}.blob.core.windows.net/${process.env.AZURE_CONTAINERNAME}/`
const port = process.env.PORT || 3000

const app = express()
app.set('view engine', 'pug')
app.use(express.static(path.join(__dirname, 'node_modules/bootstrap/dist')))
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(ipfilter(['::1', '127.0.0.1', process.env.IP_WHITELIST], {
  log: true,
  logLevel: 'all',
  mode: 'allow',
  allowedHeaders: ['x-forwarded-for']
}));

// error handling comes after all other app.use instructions
// we will end up inside here whenever there is an error encountered
// while handling the request.  in our case we're particularly interested
// in the IpDeniedError that is being thrown by the ipfilter module
app.use(function(err, req, res, next) {
  // http://expressjs.com/en/guide/error-handling.html
  if (res.headersSent) return next(err)

  if (err instanceof IpDeniedError) {
    const rejectIp = req.ip || req.header('x-forwarded-for')
    console.log(`req.ip: ${req.ip}`)
    console.log(`forw.ip: ${req.header('x-forwarded-for')}`)
    console.log(`rejectIp: ${rejectIp}`)
    console.log(`whitelist: ${process.env.IP_WHITELIST}`)
    res.status(403).render('error', {
      title: 'Access denied',
      showRejectedIp: req.ip || req.header('x-forwarded-for')
    })
  } else {
    next(err)
  }
})

app.get('/', function (req, res) {
  res.render('index', {
    title: 'PAC Dearchiver',
    inputFileName: 'blobFile'
  })
})

app.post('/', function (req, res) {
  const fileName = req.body.blobFile + '.7z'
  const fileUrl = url + fileName
  const resObject = {
    url: fileUrl,
    fileName: fileName,
    code: `${req.body.blobFile}`
  }

  try {
    if (req.body.blobFile === undefined || req.body.blobFile === '') {
      resObject.message = 'emptyCode'
      res.render('index', resObject)
    } else {
      // test existence of file
      request.head(fileUrl, function (err, response) {
        if (err) return console.log(err)
        if (response.statusCode !== 200) {
          console.log(`!!! Unknown code ${req.body.blobFile}.`)
          resObject.message = 'notFound'
        } else {
          resObject.message = 'success'
        }
        console.log(resObject)
        res.render('index', resObject)
      })
    }
  } catch (e) {
    console.log(e)
  }
})

app.listen(port, function () {
  console.log(`Dearchiver is now listening on port ${port}!`)
})
