import './bootstrap-globals';
import { createExpressHandler } from './createExpressHandler';
import express, { RequestHandler } from 'express';
//import { ServerlessFunction } from './types';
//import tokenGenerator from 'token_generator';
import http from "http";
const AccessToken = require("twilio").jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;
const { v4: uuidv4 } = require("uuid");
import path from 'path';
var cors = require('cors')
const { createProxyMiddleware } = require('http-proxy-middleware');


const port = 3001;

function tokenGenerator(identity, room) {
  // Create an access token which we will sign and return to the client,
  // containing the grant we just created
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET
  );

  // Assign identity to the token
  token.identity = identity;

  // Grant the access token Twilio Video capabilities
  const grant = new VideoGrant();
  grant.room = room;
  token.addGrant(grant);

  // Serialize the token to a JWT string
  return token.toJwt();
}

const app = express();
// use the Express JSON middleware
app.use(express.json());


// create the twilioClient
const twilioClient = require("twilio")(
  process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET, {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
}
);

const findOrCreateRoom = async (roomName) => {
  try {
    // see if the room exists already. If it doesn't, this will throw
    // error 20404.
    await twilioClient.video.rooms(roomName).fetch();
  } catch (error) {
    // the room was not found, so create it
    if (error.code == 20404) {
      await twilioClient.video.rooms.create({
        uniqueName: roomName,
        type: "go",
      });
    } else {
      // let other errors bubble up
      throw error;
    }
  }
};

const getAccessToken = (roomName) => {
  // create an access token
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    // generate a random unique identity for this participant
    { identity: uuidv4() }
  );
  // create a video grant for this specific room
  const videoGrant = new VideoGrant({
    room: roomName,
  });

  // add the video grant
  token.addGrant(videoGrant);
  // serialize the token and return it
  return token.toJwt();
};
/*
app.use((req, res, next) => {
  console.log("use path");
  // Here we add Cache-Control headers in accordance with the create-react-app best practices.
  // See: https://create-react-app.dev/docs/production-build/#static-file-caching
  if (req.path === '/' || req.path === 'index.html') {
    console.log("accessing path");
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, '../build/index.html'), { etag: false, lastModified: false });
  } else {
    res.set('Cache-Control', 'max-age=31536000');
    next();

});*/

/*app.get('/token', (_, res) => {
  console.log("accessing token get endpont");
  // Don't cache index.html
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, '../build/index.html'), { etag: false, lastModified: false });
});*/

app.use(cors());




app.use(express.static(path.resolve(__dirname, '../build')));

app.post("/token", async (req, res) => {
  console.log("accessing /token");
  // return 400 if the request has an empty body or no roomName
  if (!req.body || !req.body.room_name) {
    return res.status(400).send("Must include roomName argument.");
  }
  const roomName = req.body.room_name;
  // find or create a room with the given roomName
  findOrCreateRoom(roomName);
  // generate an Access Token for a participant in this room
  const token = getAccessToken(roomName);
  res.send({
    token: token,
  });
});

app.use('/', createProxyMiddleware({ 
    target: 'http://localhost:3001/', //original url
    changeOrigin: true,   
    //secure: false,
    onProxyRes: function (proxyRes, req, res) {
       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    }
}));
// All other GET requests not handled before will return our React app
/*app.get('*', (req, res) => {

    if (req.secure) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31000; includeSubDomains; preload"
      );

      res.setHeader('Access-Control-Allow-Origin', "*");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-control", "no-store");
    }
  res.sendFile(path.resolve(__dirname, '../build', 'index.html'));
});*/

// Start the Express server
app.listen(port, () => {
  console.log(`Express server running on port ${port}`);
});