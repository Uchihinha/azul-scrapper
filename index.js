const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const { executablePath } = require("puppeteer");
const { setTimeout } = require("node:timers/promises");
const FormData = require("form-data");
const { default: axios } = require("axios");
const fs = require("fs");

puppeteer.use(pluginStealth());

exports.handler = async (event) => {
  // const handler = async (event) => {
  let result = [];
  let browser = null;
  let page = null;

  const data = JSON.parse(event.body);
  // const data = event;
  console.log("data: ", data);

  const baseUrl = "https://www.voeazul.com.br/br/pt/home/selecao-voo?";

  const url = `${baseUrl}c[0].ds=${data.departure}&c[0].std=${data.startDate}&c[0].as=${data.arrival}&c[1].ds=${data.arrival}&c[1].std=${data.endDate}&c[1].as=${data.departure}&p[0].t=ADT&p[0].c=1&p[0].cp=false&f.dl=3&f.dr=3&cc=PTS`;
  console.log("url: ", url);

  try {
    console.log("testing================");
    // console.log("executablePath(): ", executablePath());
    // Launch the Chromium browser with necessary arguments for AWS Lambda environment
    browser = await puppeteer.launch({
      headless: true,
      //   executablePath: executablePath(),
      executablePath: "./linux-122.0.6261.57/chrome-linux64/chrome",
      // "/root/.cache/puppeteer/chrome/linux-122.0.6261.57/chrome-linux64/chrome",
      //   executablePath: await chromium.executablePath(),
      //   executablePath: "./chrome/linux-122.0.6261.57/chrome-linux64/chrome",
      waitUntil: "networkidle0",
      args: [
        "--window-size=1920,1080",
        "--no-sandbox",
        "--disable-web-security",
        "--disable-setuid-sandbox",
        // "--enable-gpu",
        "--disable-dev-shm-usage", // Added to improve compatibility
        "--single-process", // Might improve stability in Lambda's environment
      ],
    });

    console.log("teste");

    page = await browser.newPage();

    await page.setRequestInterception(true);

    page.on("request", (request) => {
      request.continue();
    });

    console.log("nova pagina");

    // await page.goto("https://www.google.com.br/");
    await page.goto("https://www.voeazul.com.br/");

    await page.waitForSelector("#onetrust-accept-btn-handler");

    await page.$("#onetrust-accept-btn-handler").then((el) => el.click());

    await setTimeout(1000);

    result = await performRequestWithRetry(page, url);

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: result,
      }),
    };
  } catch (error) {
    console.error("Error during the Puppeteer script execution", error);
    await sendScreenshotError(
      page,
      error.message || "Error during the Puppeteer script execution"
    );
    throw new Error(error);
  } finally {
    if (browser !== null) {
      console.log("finally");
      await closeBrowser(browser);
    }
  }
};

const performRequestWithRetry = async (page, requestUrl, tryCount = 0) => {
  const maxRetries = 3; // Maximum number of retries
  // Flag to indicate whether the request was successful or not
  let requestSuccessful = false;
  let result = [];

  page.on("response", async (response) => {
    const requestUrl =
      "https://b2c-api.voeazul.com.br/tudoAzulReservationAvailability/api/tudoazul/reservation/availability/v5/availability"; // Specify the request URL you're interested in

    if (response.url() === requestUrl && response.status() === 200) {
      try {
        const { data } = await response.json(); // Assuming the response is JSON. Use .text() for plain text.

        const departures = formatTrips(data.trips[0]);
        const arrivals = formatTrips(data.trips[1]);

        result = [...departures, ...arrivals];
        requestSuccessful = true;
        console.log("Captured response for:", requestUrl, result);
      } catch (error) {
        console.error(error);
        console.error("Error capturing response data:", error);
      }
    }
  });

  // Navigate to the URL or perform the action that triggers the request
  await page.goto(requestUrl, { waitUntil: "networkidle2" });

  if (!requestSuccessful) {
    if (tryCount >= maxRetries) {
      throw new Error("Failed to capture response after maximum retries");
    }

    tryCount++;

    console.log(`Request failed, retrying... Attempt ${tryCount}`);
    await page.goto("https://www.voeazul.com.br/");
    await setTimeout(1000);

    await performRequestWithRetry(page, requestUrl, tryCount);
  }

  return result;
};

const closeBrowser = async (browser) => {
  const pages = await browser.pages();
  for (let i = 0; i < pages.length; i++) {
    await pages[i].close();
  }
  console.log("closing browser");
  await browser.close();
};

const sendScreenshotError = async (page, message) => {
  const screenshotPath = `/tmp/azul.png`;
  await page.screenshot({ path: screenshotPath });

  const formData = new FormData();
  formData.append("file", fs.createReadStream(screenshotPath));
  formData.append("payload_json", JSON.stringify({ content: message }));

  await axios.post(
    "https://discord.com/api/webhooks/1203057888587939881/mHpbJhrsMe9lYUb3rgKJamd8o4MKIflqNzq6mEslxnQTZoQhiuwYeMN8ShKM4qW5t2Md",
    formData,
    {
      headers: {
        ...formData.getHeaders(),
      },
    }
  );
};

const parseDurationToMinutes = (duration) => {
  const dayToMinute = duration.days * 24 * 60;
  const hourToMinute = duration.hours * 60;
  return dayToMinute + hourToMinute + duration.minutes;
};

const formatTrips = (roughTrip) => {
  const main = roughTrip;

  const flights = [];

  for (let offer of main.journeys) {
    if (offer.fares.length === 0) continue;

    const baseInfo = {
      duration: parseDurationToMinutes(offer.identifier.duration),
      departureAirport: main.departureStation,
      arrivalAirport: main.arrivalStation,
      numberOfStops: offer.identifier.connections?.count ?? 0,
      arrivalDate: offer.segments[offer.segments.length - 1].identifier.sta,
      departureDate: offer.segments[0].identifier.std,
      source: "azul",
      airline: "Azul",
    };

    if (offer.fares.length === 1) {
      const fare = offer.fares[0];

      flights.push({
        ...baseInfo,
        milesPrice: fare.paxPoints[0].levels[0].points.discountedAmount,
        cabinClass: fare.productClass.category.toLowerCase(),
      });

      return flights;
    }

    const economyFare = offer.fares.find(
      (fare) => fare.productClass.name === "Economy"
    );

    const businessFare = offer.fares.find(
      (fare) => fare.productClass.name === "Business"
    );

    if (economyFare) {
      flights.push({
        ...baseInfo,
        milesPrice: economyFare.paxPoints[0].levels[0].points.discountedAmount,
        cabinClass: "economy",
      });
    }

    if (businessFare) {
      flights.push({
        ...baseInfo,
        milesPrice: businessFare.paxPoints[0].levels[0].points.discountedAmount,
        cabinClass: "business",
      });
    }
  }

  return flights;
};

// handler();

// exports.handler = handler;
