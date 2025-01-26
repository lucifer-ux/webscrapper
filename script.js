const { Client, MessageMedia, RemoteAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const router = express.Router();
const axios = require("axios");
const mongoose = require("mongoose");
const { MongoStore } = require("wwebjs-mongo");
var AdmZip = require("adm-zip");
const path = require("path");
const scrapeShoeDetailsSuperKick = require("./serverCode/superkicks.js");
const scrapeShoeDetailsFindYourKick = require("./serverCode/findYourKicks.js");
require("dotenv").config();

const MONGODB_URI = process.env.MONGO_URI;

const state = {};

const setState = (keyValuePairs) => {
  if (!Array.isArray(keyValuePairs)) {
    console.error(
      "Input must be an array of objects with 'keyName' and 'value'."
    );
    return;
  }

  keyValuePairs.forEach(([keyName, value]) => {
    if (keyName === undefined || value === undefined) {
      console.error("Each object must contain 'keyName' and 'value'.");
      return;
    }
    state[keyName] = value;
  });
};

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

    const number = process.env.FROM_MOBILE_NUMBER;
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

    if (message.body.toLowerCase() === "hi" || message.body.toLowerCase() === "hey") {
      await message.reply(
        `Hey ${message.notifyName}, can you send me the name of the shoe you are looking for?`
      );
      return;
    }
    try {
      if (isObjectEmpty(state)) {
        await client.sendMessage(
          numberDetails._serialized,
          "please wait we are looking for what you asked for..🥹"
        )
        const responseValue = await shoeDetailsSuperKick(message.body);
        if (responseValue === "__failed") {
          await client.sendMessage(
            numberDetails._serialized,
            "Sorry we couldn't find the shoe, please check the name"
          );
        } else {
          console.log(state)
          const foundNames = extractShoeNamePlaces(state);
          await client.sendMessage(
            numberDetails._serialized,
            `we found shoes for you from ${foundNames
              .map((place) => place)
              .join(", ")}`
          );
          await message.reply(
            `please enter the option i.e. 1 for first 2 for second to see the results`
          );
          if ((message.body - 1) >= Object.keys(state).length || (message.body -1) < 0) {
            await message.reply(
              "The option exceeds the list please enter a correct option"
            );
          } else {
            console.log(message.body, "messaggeeee")
            const shoe = state[Object.keys(state)[message.body - 1]];
            const smallImageUrl = shoe?.image;
            const buyUrl = shoe?.url;
            const title = shoe?.name;
            const media = await MessageMedia.fromUrl(smallImageUrl);
            const price = shoe?.price;
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
              "Price " + " " + price
            );
            await client.sendMessage(
              numberDetails._serialized,
              "Buy from" + " " + buyUrl
            );
          }
        }
      } else {
        const foundNames = extractShoeNamePlaces(state);
        if (message.body > Object.keys(state).length || message.body < 0) {
          await message.reply(
            "The option exceeds the list please enter a correct option"
          );
        } else {
          const shoe = state[Object.keys(state)[message.body]];
          const smallImageUrl = shoe?.image;
          console.log(shoe);
          const buyUrl = shoe?.url;
          const title = shoe?.name;
          const media = await MessageMedia.fromUrl(smallImageUrl);
          const price = shoe?.price;
          await client.sendMessage(message.from, media);
          await client.sendMessage(
            numberDetails._serialized,
            "Here’s the detailed info for the sneaker you searched for:"
          );
          await client.sendMessage(
            numberDetails._serialized,
            "Shoe Name " + title
          );
          await client.sendMessage(numberDetails._serialized, "Price" + price);
          await client.sendMessage(
            numberDetails._serialized,
            "Buy from" + buyUrl
          );
        }
      }
    } catch (e) {
      console.log(e);
    }
  });
});

const shoeDetailsSuperKick = async (shoeName) => {
  responseSuperKicks = await scrapeShoeDetailsSuperKick(shoeName);
  responseFindYourKicks = await scrapeShoeDetailsFindYourKick(shoeName);
  const stateValue = [
    ["resValueForSuperKicks", responseSuperKicks],
    ["resValueForFindYourKicks", responseFindYourKicks],
  ];
  setState(stateValue);
  return stateValue === [] ? "__failed" : "__success";
};

const extractShoeNamePlaces = (state) => {
  const result = [];
  for (const key in state) {
    if (key.startsWith("resValueFor")) {
      const companyName = key.replace("resValueFor", "");
      result.push("*" + companyName + "*");
    }
  }
  return result;
};

const isObjectEmpty = (objectName) => {
  return (
    objectName &&
    Object.keys(objectName).length === 0 &&
    objectName.constructor === Object
  );
};