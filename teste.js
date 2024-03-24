const puppeteer = require("puppeteer-extra");
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const exec = require("child_process").exec;
const { setTimeout } = require("node:timers/promises");
const FormData = require("form-data");
const fs = require("fs");
const { default: axios } = require("axios");

puppeteer.use(pluginStealth());

/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string}
 * @return {Promise<string>}
 */
async function execShellCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      console.log("aqui dentro");
      resolve(stdout ? stdout : stderr);
    });
  });
}

exports.handler = async (event, context, callback) => {
  // Attempt to launch Xvfb
  console.log("teste");
  let output = execShellCommand(
    "Xvfb :99 -ac -screen 0 1024x768x24 -nolisten tcp &"
  );
  console.log(output);

  execShellCommand(
    "for i in 1 2 3 4 5; do xdpyinfo -display $DISPLAY >/dev/null 2>&1 && break || sleep '1s'; done"
  );

  let result = null;
  let browser = null;

  try {
    console.log("salve");
    browser = await puppeteer.launch({
      headless: true,
      executablePath: "google-chrome-stable",
      args: [
        "--window-size=1920,1080",
        "--no-sandbox",
        "--disable-web-security",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        // "--enable-gpu",
        "--disable-dev-shm-usage", // Added to improve compatibility
        "--single-process", // Might improve stability in Lambda's environment
        // "--user-data-dir=/tmp/chrome-user-data",
      ],
    });

    let page = await browser.newPage();

    console.log("deu bom aqui");

    await page.goto("https://www.voeazul.com.br/", {
      waitUntil: "networkidle2",
    });

    await sendScreenshotError(page, "teste");

    //get the user-agent
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log(userAgent);
  } catch (error) {
    return callback(error);
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }

  console.log("acabou");

  return callback(null, result);
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
