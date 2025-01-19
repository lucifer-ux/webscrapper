// const puppeteer = require("puppeteer");

// async function scriptValues (href)
//   {
//     const url = `https://stockx.com/search?s=${href}`
//     const browser = await puppeteer.launch({ headless: false });
//     const page = await browser.newPage();
//     let val = ""
//     try {
//       const customUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:78.0) Gecko/20100101 Firefox/78.0";
//       await page.setUserAgent(customUA);
//       await page.goto(url);

//       await page.waitForSelector('#main-content > div > section:nth-child(9) > div >div >div > div:nth-child(1) > dl > dd', { timeout: 122000 });

//       const shoeDetailsArray = await page.evaluate(() => {
//           val = document.querySelector('#main-content > div > section:nth-child(9) > div >div >div > div:nth-child(1) > dl > dd').textContent
//           return { val };
//       });
//       console.log(shoeDetailsArray);
//       return shoeDetailsArray;
//       } catch (error) {
//           console.error('Error:', error);
//           return {val};
//       } finally {
//           await browser.close();
//       }
    
//   }

const puppeteer = require('puppeteer-extra');
const userAgent = require('user-agents');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Adding Stealth Plugin to puppeteer
puppeteer.use(StealthPlugin());

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchAndScrape(shoeName) {
    const { executablePath } = require('puppeteer');

    const browser = await puppeteer.launch({ headless: false, executablePath: executablePath() });
    await sleep(1000)
    const page = await browser.newPage();
    const url = `https://stockx.com/search?s=${encodeURIComponent(shoeName)}`;
    
    try {
        await page.setUserAgent(userAgent.random().toString());
        await sleep(1000)
        await page.goto(url, { waitUntil: 'networkidle2' });

        await page.waitForSelector('#header-wrapper > div > div > div > div > div > div > div', { timeout: 21000 });  
        await page.type('#header-wrapper > div > div > div > div > div > div > div', shoeName); 
        await page.mouse.move(Math.random() * 1000, Math.random() * 3000); 
        await page.mouse.move(Math.random() * 1000, Math.random() * 1000);
        // await page.waitForSelector('#product-results > div:nth-child(1) > div > a > div > div > div > p', { timeout: 21000 });  
        const scrapedData = await page.evaluate(() => {
            const data = document.querySelector('#product-results > div:nth-child(1) > div > a > div > div > div > p')?.textContent; 
            return data.trim();
        });
        await page.mouse.move(Math.random() * 1000, Math.random() * 1000);
        await sleep(4000)
        console.log('Scraped Data:', scrapedData);
    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }
}

const shoeName = "Nike Blazer Low '77 Jumbo SE 'LT Smoke Grey/Sail-Photon Dust'";  
searchAndScrape(shoeName);



// Example call to the function
// scriptValues("nike-zoom-kobe-4-protro-girl-dad").then(result => {
//     console.log("Scraped Data:", result);
// }).catch(error => {
//     console.error("Error in scraping:", error);
// });
