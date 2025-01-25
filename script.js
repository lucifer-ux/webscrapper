const { Client, MessageMedia, RemoteAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const router = express.Router();
const axios = require("axios");
const mongoose = require('mongoose');
const { MongoStore } = require('wwebjs-mongo');
var AdmZip = require('adm-zip');
const path = require('path');
const scrapeShoeDetails = require('./serverCode/superkicks.js');
require('dotenv').config()

const MONGODB_URI = process.env.MONGO_URI

mongoose.connect(MONGODB_URI).then(async () => {
  const store = new MongoStore({ mongoose: mongoose });
  
  const clientId = "newClientId";

  const sessionExists = await store.sessionExists({ session: clientId });
  console.log(sessionExists, "sessionexists");
  if (sessionExists) {
    console.log("Session found in MongoDB, loading session...");
  } else {
    console.log("Session not found, initializing new session...");
  }
let client;
let isWhitelisted;
  client = new Client({
    authStrategy: new RemoteAuth({
      clientId: clientId,
      store: store,
      backupSyncIntervalMs: 300000,
    }),
  });
  
  client.on("remote_session_saved", () => {
    console.log("Remote session saved to MongoDB");
  });
  
  client.initialize();

  client.once("ready", async () => {
    console.log("Client is ready!");

    const number = "6392212826";
    const sanitized_number = number.toString().replace(/[- )(]/g, "");
    const final_number = `91${sanitized_number.substring(
      sanitized_number.length - 10
    )}`;
    const whitelist = process.env.MOBILE_NUMBER_ARRAY;
    isWhitelisted = (number) => whitelist.includes(number.split("@")[0]);

    const number_details = await client.getNumberId(final_number); 

    if (number_details) {
      console.log("scrapeValue");
    } else {
      console.log(final_number, "Mobile number is not registered");
    }
  });

  client.on("qr", (qr) => {
    if (!sessionExists) {
      qrcode.generate(qr, { small: true });
      console.log("QR RECEIVED", qr);
    }
  });

  let tmpIntvl = setInterval(async function () {
    if (client.pupPage == null) {
      return;
    }
    client.pupPage.setDefaultNavigationTimeout(300000);
    clearInterval(tmpIntvl);
  }, 1000);

  client.on("message_create", async (message) => {
    console.log(message.from, "message.from");
    const senderNumber = message.from.split("@")[0];
    const numberDetails = await client.getNumberId(message.from);

    if (!isWhitelisted(senderNumber)) {
      console.log(`Number ${senderNumber} is not whitelisted.`);
      return;
    }

       if (message.body.toLowerCase() === "hi") {
    await message.reply(
      `Hey ${message.notifyName}, can you send me the shoe you want?`
    );
    return;
  }
  try {

    const responseValue = await shoeDetailsSuperKick(message.body);
        if (responseValue === "__failed") {
          await client.sendMessage(
            numberDetails._serialized,
            "Sorry we couldn't find the shoe, please check the name"
          );
        } else {
          console.log(
            responseValue,
            "responseValue"
          );
          const smallImageUrl = responseValue[0]?.image;
          const buyUrl = responseValue[0]?.url;
          const title = responseValue[0]?.name;
          const media = await MessageMedia.fromUrl(smallImageUrl);
          const price = responseValue[0]?.price;
          await client.sendMessage(message.from, media);
          await client.sendMessage(
            numberDetails._serialized,
            "Here’s the detailed info for the sneaker you searched for:"
          );
          await client.sendMessage(
            numberDetails._serialized,
            "Shoe Name " + title
          );
          await client.sendMessage(
            numberDetails._serialized,
            "Price" + price
          );
          await client.sendMessage(
            numberDetails._serialized,
            "Buy from" + buyUrl
          );
          
        }

  }
  catch(e)
  {
    console.log(e);
  }
              
    // }
  });
});

const shoeDetailsSuperKick = async (shoeName) => {
response = await scrapeShoeDetails(shoeName);
console.log(response);
return (response === []) ? "__failed" : response;
}