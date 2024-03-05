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

exports.handler = async (event) => {
  // const handler = async (event) => {
  let result = null;
  let browser = null;

  const url =
    "https://www.voeazul.com.br/br/pt/home/selecao-voo?c[0].ds=GRU&c[0].std=06/11/2024&c[0].as=FLL&c[1].ds=FLL&c[1].std=06/20/2024&c[1].as=GRU&p[0].t=ADT&p[0].c=1&p[0].cp=false&f.dl=3&f.dr=3&cc=BRL";

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

    // Take a screenshot
    await sendScreenshotError(page, "Teste");
    // const screenshotPath = `./azul.png`;
    // await page.screenshot({ path: screenshotPath });
    // result = await page.screenshot({ encoding: "base64" });

    console.log("Screenshot taken");
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
      message: "Screenshot taken successfully",
    }),
  };
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
