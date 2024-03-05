const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const FormData = require("form-data");
const { default: axios } = require("axios");
const fs = require("fs");
puppeteer.use(pluginStealth());

const uploadScreenshot = async (screenshotPath) => {
  // Example of uploading to a Discord webhook
  const formData = new FormData();
  formData.append("file", fs.createReadStream(screenshotPath));
  formData.append(
    "payload_json",
    JSON.stringify({ content: "Screenshot upload" })
  );

  await axios.post(
    "https://discord.com/api/webhooks/1203057888587939881/mHpbJhrsMe9lYUb3rgKJamd8o4MKIflqNzq6mEslxnQTZoQhiuwYeMN8ShKM4qW5t2Md",
    formData,
    {
      headers: { ...formData.getHeaders() },
    }
  );
  console.log("Screenshot uploaded");
};

const handler = async (event) => {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: "./linux-122.0.6261.57/chrome-linux64/chrome",
      args: [
        "--window-size=1920,1080",
        "--no-sandbox",
        "--disable-web-security",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Added to improve compatibility
        "--single-process", // Might improve stability in Lambda's environment
      ],
    });
    const page = await browser.newPage();

    const url = "https://www.voeazul.com.br/br/pt/home";
    await page.goto(url, { waitUntil: "networkidle2" });
    // Navigate and interact with the page
    const screenshotPath = `./final.png`;
    await page.screenshot({ path: screenshotPath });

    // Upload the screenshot
    await uploadScreenshot(screenshotPath);
    console.log("Screenshot taken and uploaded");
  } catch (error) {
    console.error("Error", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Screenshot taken, saved, and uploaded" }),
  };
};

exports.handler = handler;
