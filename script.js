const { Client, MessageMedia, RemoteAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const router = express.Router();
const axios = require("axios");
const mongoose = require('mongoose');
const { MongoStore } = require('wwebjs-mongo');
var AdmZip = require('adm-zip');
const path = require('path');
require('dotenv').config();

const {
  headersForData,
  headersForName,
} = require("./serverCode/TryingToWrite/Headers.js");
const {
  querryForData,
  querryForName,
} = require("./serverCode/TryingToWrite/querry.js");
const {
  extractSneakerDetails,
} = require("./serverCode/TryingToWrite/Helper.js");

const MONGODB_URI =  process.env.MONGO_URI 

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

  client = new Client({
    authStrategy: new RemoteAuth({
      clientId: clientId,
      store: store,
      backupSyncIntervalMs: 300000, // Sync backup every 5 minutes
    }),
  });
  
  client.on("remote_session_saved", () => {
    console.log("Remote session saved to MongoDB");
  });
  
  client.initialize();
//   const sessionFilePath = path.join(__dirname, `${clientId}.chunks`);
//   await store.extract({
//     session: clientId,
//     path: sessionFilePath
// });

  // const collectionExist = await collectionExists(clientId);
  // console.log("boolValue", collectionExist);
  // let client;

  // if (collectionExist) {
  //   console.log("Session found in MongoDB, loading session...");

  //   // Load the existing session without re-initializing
  //   client = new Client({
  //     authStrategy: new RemoteAuth({
  //       clientId: clientId,
  //       store: store,
  //       backupSyncIntervalMs: 300000,
  //     }),
  //   });
  //   client.initialize();
  // } else {
  //   console.log("Session not found, initializing new session...");

  //   // Create and store a new session
  //   client = new Client({
  //     authStrategy: new RemoteAuth({
  //       clientId: clientId,
  //       store: store,
  //       backupSyncIntervalMs: 300000,
  //     }),
  //   });

  //   client.on("remote_session_saved", () => {
  //     console.log("New remote session saved to MongoDB");
  //   });

  //   client.initialize(); // Only initialize if the session is new
  // }

  client.once("ready", async () => {
    console.log("Client is ready!");

    const number = "6392212826";
    const sanitized_number = number.toString().replace(/[- )(]/g, "");
    const final_number = `91${sanitized_number.substring(
      sanitized_number.length - 10
    )}`;
    const whitelist = ["0987654321", "918707853820", "916392212826", "919348456270"];
    const isWhitelisted = (number) => whitelist.includes(number.split("@")[0]);

    const number_details = await client.getNumberId(final_number); 

    if (number_details) {
      console.log("scrapeValue");
    } else {
      console.log(final_number, "Mobile number is not registered");
    }
  });

  client.on("qr", (qr) => {
    if (!sessionExists) { // Only show QR code if session does not exist
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
    // if (isWhitelisted(senderNumber)) {
      // console.log(
      //   `Message from whitelisted number ${senderNumber}: ${message.body}`
      // );

      if (message.body === "hi" || message.body === "Hi") {
        message.reply(
          `hey ${message.notifyName}, can you send me the shoe you want?`
        );
      } else {
        const responseValue = await fetchFunction(message.body);
        if (responseValue === "__failed") {
          await client.sendMessage(
            numberDetails._serialized,
            "Sorry we couldn't find the shoe, please check the name"
          );
        } else {
          console.log(
            responseValue.responseForShoes?.data?.data?.product?.market,
            "responseValue"
          );
          const product = responseValue.responseForExtraData?.data?.data?.product;
          const smallImageUrl = product?.media?.smallImageUrl;
          const title = product?.primaryTitle;
          const salesInformation =
            responseValue.responseForShoes?.data?.data?.product?.market
              ?.salesInformation;
          console.log(salesInformation?.pricePremium);
          console.log(product?.media?.smallImageUrl, "responseValue");
          const media = await MessageMedia.fromUrl(smallImageUrl);
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
            "Price Premium " + salesInformation?.pricePremium
          );
          await client.sendMessage(
            numberDetails._serialized,
            "Volatility " + salesInformation?.volatility
          );
          await client.sendMessage(
            numberDetails._serialized,
            "Description " + product?.description
          );
          await client.sendMessage(
            numberDetails._serialized,
            "Style " + product?.traits[0]?.value
          );
          await client.sendMessage(
            numberDetails._serialized,
            "Colorway " + product?.traits[1]?.value
          );
          await client.sendMessage(
            numberDetails._serialized,
            "Retail Price " + "$ " + product?.traits[2]?.value 
          );
        }
      }
    // }
  });
});

const fetchFunction = async (name) => {
  try {
    console.log(`Fetching data for name: ${name}`); 
    const response = await axios.post(
      `http://localhost:3000/api/fetch-name?name=${name}`
    );
    console.log(extractSneakerDetails(response), "tessttinggg")
    if (extractSneakerDetails(response)) {
      const extractedValues = extractSneakerDetails(response);
      const responseForShoes = await axios.post(
        `http://localhost:3000/api/fetch-data?pid=${extractedValues?.urlKey}`
      );
      const responseForExtraData = await axios.post(
        `http://localhost:3000/api/fetch-extra-data?pid=${extractedValues?.urlKey}`
      );
      console.log(
        "Response from server:",
        responseForShoes?.data?.data?.product?.market?.salesInformation
      );
      console.log(
        "reeesspponnseee",
        responseForExtraData?.data?.data?.product?.media?.smallImageUrl
      );
      return { responseForShoes, responseForExtraData };
    } else {
      console.log("value not found");
      return "__failed";
    }
  } catch (error) {
    console.error("Error fetching name data:", error);
    throw error;
  }
};

// async function collectionExists(clientId) {
//   const collectionName = `whatsapp-RemoteAuth-${clientId}.files`;
  
//   const collections = await mongoose.connection.db.listCollections().toArray();

//   const collection = collections.find(c => c.name === collectionName);
  
//   return collection;
// }