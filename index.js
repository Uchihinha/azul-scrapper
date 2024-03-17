const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const { executablePath } = require("puppeteer");
const { setTimeout } = require("node:timers/promises");
const FormData = require("form-data");
const { default: axios } = require("axios");
const fs = require("fs");

// const puppeteer = require("puppeteer-core");
// const chromium = require("@sparticuz/chromium");

puppeteer.use(pluginStealth());

// chromium.setHeadlessMode = true;
// chromium.setHeadlessMode = "new";

const getFlightLegInfo = async (fareCard) => {
  const flightLegInfo = await fareCard.$eval(
    ".flight-leg-info button span:last-of-type",
    (el) => el.textContent.trim()
  );

  return flightLegInfo;
};

const getTimeInfo = async (flightCard) => {
  const flightDuration = await flightCard
    .$$(".flight-card__info .info div:last-child")
    .then((items) => items[1]);

  const buttonText = await flightDuration.$eval("button strong", (el) =>
    el.textContent.trim()
  );
  return buttonText;
};

const getDepartureTime = async (flightCard) => {
  const departureTime = await flightCard.$eval(
    ".flight-card__info .info .departure",
    (el) => el.textContent.trim()
  );

  return departureTime;
};

const getArrivalTime = async (flightCard) => {
  const arrivalTime = await flightCard.$eval(
    ".flight-card__info .info .arrival",
    (el) => el.textContent.trim()
  );

  return arrivalTime;
};

const findLegConnection = (legInfo) => {
  if (legInfo.toLowerCase().includes("direto")) {
    return 0;
  }

  if (legInfo.toLowerCase().includes("conexão")) {
    return 1;
  }

  return parseInt(legInfo.toLowerCase().split("conexões")[0]);
};

const cleanMilesPrice = (milesPrice) => {
  let numericString = milesPrice.replace(/[^\d.,]/g, "");

  numericString = numericString.replace(/\./g, "");

  return parseInt(numericString, 10);
};

exports.handler = async (event) => {
  // const handler = async (event) => {
  let result = null;
  let browser = null;
  let offers = [];
  let page = null;

  // const data = JSON.parse(event.body);
  const data = event;
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

    const offers = await performRequestWithRetry(page, url);

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: "offers",
      }),
    };

    // await page.goto(url);

    let isLoaded = false;

    while (!isLoaded) {
      try {
        await page.waitForSelector("section.card-list", { timeout: 5000 });
        isLoaded = true;
      } catch (error) {
        console.log("deu um talento");
        const noResults = await page.$(".no-results-childs");
        if (noResults) {
          console.log("No results found");
          return [];
        }

        await page.goto("https://www.voeazul.com.br/");
        await setTimeout(1000);
        await page.goto(url);
        console.error("Error on waitForSelector");
      }
    }

    try {
      await page.waitForSelector("#load-more-button");
      await page.$eval("#load-more-button", (el) => el.click());
    } catch (error) {
      console.log("não tem mais páginas");
    }

    await page.waitForSelector(".trip-index-0 .flight-card .card-content");

    try {
      await page.waitForSelector(
        "[data-test-id='fare-price fare-price-with-points']"
      );
    } catch (error) {
      await sendScreenshotError(
        page,
        "Error on [data-test-id='fare-price fare-price-with-points']"
      );
      await closeErrorModal(page);
    }

    let flightCards = await page.$$(".trip-index-0 .flight-card");

    for (let flightCard of flightCards) {
      const legInfo = await getFlightLegInfo(flightCard);
      const duration = await getTimeInfo(flightCard);
      const departure = await flightCard.$eval(".iata-day:not(.arrival)", (e) =>
        e.textContent.trim()
      );
      const arrival = await flightCard.$eval(".iata-day.arrival", (e) =>
        e.textContent.trim()
      );
      const fareItem = await flightCard.$(".fare-container.right");
      const farePrice = await fareItem.$(
        ".fare .current[data-test-id='fare-price fare-price-with-points']"
      );
      const departureTime = await getDepartureTime(flightCard);
      const arrivalTime = await getArrivalTime(flightCard);

      if (farePrice) {
        let milesPrice = await farePrice.evaluate((x) => x.textContent);
        offers.push({
          legInfo,
          departure,
          arrival,
          milesPrice,
          duration,
          departureTime,
          arrivalTime,
        });
      }
    }

    offers = offers.map((offer) => {
      const departureAirport = offer.departure.slice(0, 3);
      const arrivalAirport = offer.arrival.slice(0, 3);
      const numberOfStops = findLegConnection(offer.legInfo);
      const departureTime = offer.departureTime.substr(0, 5);
      const arrivalTime = offer.arrivalTime.substr(0, 5);

      const arrivalDate =
        offer.arrival.slice(-5).length < 5
          ? formatAzulDate(data.endDate, arrivalTime)
          : formatFlightDate(offer.arrival.slice(-5), arrivalTime);

      const departureDate = formatAzulDate(data.startDate, departureTime);

      return {
        duration: parseDurationToMinutes(offer.duration),
        milesPrice: cleanMilesPrice(offer.milesPrice || 0),
        departureAirport,
        arrivalAirport,
        numberOfStops,
        arrivalDate,
        departureDate,
        source: "azul",
        cabinClass: "economy",
        airline: "Azul",
      };
    });

    // Take a screenshot
    // await sendScreenshotError(page, "Teste");

    console.log("offers: ", offers);
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

  return {
    statusCode: 200,
    body: JSON.stringify({
      data: offers,
    }),
  };
};

const performRequestWithRetry = async (page, requestUrl, tryCount = 0) => {
  const maxRetries = 3; // Maximum number of retries
  // Flag to indicate whether the request was successful or not
  let requestSuccessful = false;

  page.on("response", async (response) => {
    const requestUrl =
      "https://b2c-api.voeazul.com.br/tudoAzulReservationAvailability/api/tudoazul/reservation/availability/v5/availability"; // Specify the request URL you're interested in

    if (response.url() === requestUrl && response.status() === 200) {
      try {
        const { data } = await response.json(); // Assuming the response is JSON. Use .text() for plain text.

        const departureMain = data.trips[0];

        const departures = departureMain.journeys.map((offer) => {
          return {
            duration: parseDurationToMinutes(offer.identifier.duration),
            milesPrice:
              offer.fares[0].paxPoints[0].levels[0].points.discountedAmount,
            departureAirport: departureMain.departureStation,
            arrivalAirport: departureMain.arrivalStation,
            numberOfStops: offer.identifier.connections.count,
            arrivalDate:
              offer.segments[offer.segments.length - 1].identifier.sta,
            departureDate: offer.segments[0].identifier.std,
            source: "azul",
            cabinClass: "economy",
            airline: "Azul",
          };
        });
        requestSuccessful = true;
        console.log("Captured response for:", requestUrl, responseData);
      } catch (error) {
        console.error("Error capturing response data:", error);
      }
    }
  });

  // Navigate to the URL or perform the action that triggers the request
  await page.goto(requestUrl, { waitUntil: "networkidle2" });

  if (!requestSuccessful) {
    if (tryCount >= maxRetries) {
      await sendScreenshotError(
        page,
        "Failed to capture response after maximum retries"
      );
      throw new Error(error);
    }

    console.log(`Request failed, retrying... Attempt ${tryCount + 1}`);
    await page.goto("https://www.voeazul.com.br/");
    await setTimeout(1000);

    await performRequestWithRetry(page, requestUrl, tryCount + 1);
  }
};

const closeErrorModal = async (page) => {
  const parentElement = await page.waitForSelector("#FAILED_COMMUNICATION");
  const childElement = await parentElement.$(
    "[data-testid='search-box-hotel-date-picker-primary-button']"
  );
  await childElement.click();
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

const formatFlightDate = (dateString, timeString) => {
  // Split the date and time strings
  const [day, month] = dateString.split("/").map(Number);
  const [hour, minute] = timeString.split(":").map(Number);

  // Get the current year
  const year = new Date().getFullYear();

  // Create a new Date object
  const date = new Date(year, month - 1, day, hour, minute);
  return date;
};

const formatAzulDate = (dateString, timeString) => {
  const [month, day, year] = dateString.split("/").map(Number);
  const [hour, minute] = timeString.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  return date;
};

const parseDurationToMinutes = (duration) => {
  const dayToMinute = duration.days * 24 * 60;
  const hourToMinute = duration.hours * 60;
  return dayToMinute + hourToMinute + duration.minutes;
};

// handler();

// exports.handler = handler;
