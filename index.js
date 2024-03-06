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

exports.handler = async (event) => {
  // const handler = async (event) => {
  let result = null;
  let browser = null;
  const offers = [];

  const url =
    "https://www.voeazul.com.br/br/pt/home/selecao-voo?c[0].ds=GRU&c[0].std=06/11/2024&c[0].as=FLL&c[1].ds=FLL&c[1].std=06/20/2024&c[1].as=GRU&p[0].t=ADT&p[0].c=1&p[0].cp=false&f.dl=3&f.dr=3&cc=PTS";

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

    const page = await browser.newPage();

    console.log("nova pagina");

    // await page.goto("https://www.google.com.br/");
    await page.goto("https://www.voeazul.com.br/");

    await page.waitForSelector("#onetrust-accept-btn-handler");

    await page.$("#onetrust-accept-btn-handler").then((el) => el.click());

    await setTimeout(1000);

    await page.goto(url);

    // const userAgentString = await page.evaluate(() => navigator.userAgent);
    // console.log(`The user agent is: ${userAgentString}`);

    let isLoaded = false;

    while (!isLoaded) {
      try {
        await page.waitForSelector("section.card-list", { timeout: 5000 });
        isLoaded = true;
      } catch (error) {
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

    await page.waitForSelector(".flight-card .card-content");

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

    let flightCards = await page.$$(".flight-card");

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

    for (const offer of offers) {
      const departureAirport = offer.departure.slice(0, 3);
      const arrivalAirport = offer.arrival.slice(0, 3);
      const travelHours = offer.duration.split("\n")[0];
      const travelMinutes =
        offer.duration.split("\n")[offer.duration.split("\n").length - 1];
      const numberOfStops = findLegConnection(offer.legInfo);
      const departureTime = offer.departureTime.substr(0, 5);
      const arrivalTime = offer.arrivalTime.substr(0, 5);

      const formatedOffer = {
        travelTime: {
          hours: parseInt(travelHours),
          minutes: parseInt(travelMinutes),
        },
        milesPrice: cleanMilesPrice(offer.milesPrice || 0),
        departureAirport,
        arrivalAirport,
        numberOfStops,
        arrivalTime,
        departureTime,
      };
    }

    // Take a screenshot
    // await sendScreenshotError(page, "Teste");

    console.log("offers: ", offers);
  } catch (error) {
    console.error("Error during the Puppeteer script execution", error);
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

// handler();

// exports.handler = handler;
