const config = require('config');
const config_headless = config.get("browser.headless") || false;
const config_args = config.get("browser.args") || [];

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const userAgentList = (() => {
    const UserAgent = require('user-agents');
    const { parse } = require('useragent');
    return new UserAgent((data) => {
        const os = parse(data.userAgent);
        return (os.family === 'Firefox' && parseInt(os.major) > 70) || (os.family === 'Chrome' && parseInt(os.major) > 79);
    });
})();
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36';


const fs = require('fs');
const path = require('path');
const https = require('https')
const AdmZip = require("adm-zip");

const pluginURL = 'https://antcpt.com/anticaptcha-plugin.zip';

(async () => {
    if (!fs.existsSync('./plugin.zip')) {
        // download the plugin
        await new Promise((resolve) => {
            https.get(pluginURL, resp => resp.pipe(fs.createWriteStream('./plugin.zip').on('close', resolve)));
        })
        // unzip it
        const zip = new AdmZip("./plugin.zip");
        await zip.extractAllTo("./plugin/", true);
    }
})();

const apiKey = config.get("anti-captcha-apikey");
if (fs.existsSync('./plugin/js/config_ac_api_key.js')) {
    let confData = fs.readFileSync('./plugin/js/config_ac_api_key.js', 'utf8');
    confData = confData.replace(/antiCapthaPredefinedApiKey = ''/g, `antiCapthaPredefinedApiKey = '${apiKey}'`);
    fs.writeFileSync('./plugin/js/config_ac_api_key.js', confData, 'utf8');
} else {
    console.error('plugin configuration not found!')
}

const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    (process.pkg
        ? path.join(
            path.dirname(process.execPath),
            'puppeteer',
            ...puppeteer
                .executablePath()
                .split(path.sep)
                .slice(6), // /snapshot/project/node_modules/puppeteer/.local-chromium
        )
        : puppeteer.executablePath());

module.exports.initialize = () => new Promise(async (resolve, reject) => {
    if (fs.existsSync(executablePath))
        return resolve();
    try {

        const revisions_js_1 = require(path.join(__dirname, "/node_modules/puppeteer/lib/cjs/puppeteer/revisions.js"));
        const revision = (process.env.PUPPETEER_CHROMIUM_REVISION ||
            process.env.npm_config_puppeteer_chromium_revision ||
            revisions_js_1.PUPPETEER_REVISIONS.chromium)

        const node_js_1 = require(path.join(__dirname, "/node_modules/puppeteer/lib/cjs/puppeteer/node.js"));
        const browserFetcher = node_js_1.default.createBrowserFetcher({ product: 'chrome', path: path.resolve(`.${path.sep}puppeteer`) });
        const revisionInfo = browserFetcher.revisionInfo(revision);

        console.log('Start Download Chromium');

        function onSuccess(localRevisions) {
            console.log(`Chromium (${revisionInfo.revision}) downloaded to ${revisionInfo.folderPath}`);
            return resolve();

        }
        function onError(error) {
            console.error(`ERROR: Failed to set up Chromium r${revision}! Set "PUPPETEER_SKIP_DOWNLOAD" env variable to skip download.`);
            return reject(error);
        }

        const progress_1 = require("progress");
        let progressBar = null;
        let lastDownloadedBytes = 0;
        function onProgress(downloadedBytes, totalBytes) {
            if (!progressBar) {
                progressBar = new progress_1(`Downloading Chromium r${revision} - ${toMegabytes(totalBytes)} [:bar] :percent :etas `, {
                    complete: '=',
                    incomplete: ' ',
                    width: 20,
                    total: totalBytes,
                });
            }
            const delta = downloadedBytes - lastDownloadedBytes;
            lastDownloadedBytes = downloadedBytes;
            progressBar.tick(delta);
        }

        return browserFetcher
            .download(revisionInfo.revision, onProgress)
            .then(() => browserFetcher.localRevisions())
            .then(onSuccess)
            .catch(onError);

        function toMegabytes(bytes) {
            const mb = bytes / 1024 / 1024;
            return `${Math.round(mb * 10) / 10} Mb`;
        }
    } catch (e) {
        console.error(e);
    }

});

module.exports.newBrowser = (url, userDataDir, pageLoadElement) => new Promise(async (resolve, reject) => {
    try {
        userDataDir = path.resolve(userDataDir) + path.sep;
        const defaultViewport = {
            width: 1920 + Math.floor(Math.random() * 100),
            height: 700 + Math.floor(Math.random() * 100),
            deviceScaleFactor: 1,
            hasTouch: false,
            isLandscape: false,
            isMobile: false,
        };
        var browser = await puppeteer.launch({
            executablePath,
            headless: config_headless,
            defaultViewport: defaultViewport,
            args: config_args,
            ignoreHTTPSErrors: true,
            userDataDir: userDataDir
        });

        const pages = await browser.pages();
        const page = (pages && pages.length > 0) ? pages[0] : await browser.newPage();


        let UA = DEFAULT_USER_AGENT;
        const userAgentFilePath = userDataDir + 'userAgent.txt';
        if (fs.existsSync(userAgentFilePath)) {
            UI = fs.readFileSync(userAgentFilePath, "utf8");
        } else {
            UA = userAgentList.random().toString();
            UA = userAgentList.random().toString();
            fs.writeFile(userAgentFilePath, UA, function () { });
        }

        await page.setViewport(defaultViewport);
        await page.setUserAgent(UA);
        await page.setJavaScriptEnabled(true);
        await page.setDefaultNavigationTimeout(0);

        //Skip images/styles/fonts loading for performance
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (req.resourceType() == 'font' || req.resourceType() == 'image') {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.evaluateOnNewDocument(() => {
            // Pass webdriver check
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        await page.evaluateOnNewDocument(() => {
            // Pass chrome check
            window.chrome = {
                runtime: {},
                // etc.
            };
        });

        await page.evaluateOnNewDocument(() => {
            //Pass notifications check
            const originalQuery = window.navigator.permissions.query;
            return window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        });

        await page.evaluateOnNewDocument(() => {
            // Overwrite the `plugins` property to use a custom getter.
            Object.defineProperty(navigator, 'plugins', {
                // This just needs to have `length > 0` for the current test,
                // but we could mock the plugins too if necessary.
                get: () => [1, 2, 3, 4, 5],
            });
        });

        await page.evaluateOnNewDocument(() => {
            // Overwrite the `languages` property to use a custom getter.
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        });


        page.on('error', (err) => {
            if (err && err.message && err.message.indexOf('crashed') >= 0)
                setTimeout(() => page.reload(), 1000);
            console.error("page error:", err);
        });

        /*const cookieFilePath = userDataDir +'cookies.json';
        if (fs.existsSync(cookieFilePath)) {
            const cookiesString = fs.readFileSync( cookieFilePath, 'utf8');        
            const cookies = JSON.parse(cookiesString);
    
            await page.setCookie.apply(page, cookies);
        }

        browser.saveCookies = async function () {
            const cookies = await page.cookies()
            fs.writeFile(cookieFilePath, JSON.stringify(cookies, null, 2), function(){});
            return resolve();
        };
        */

        await page.goto(url, { waitUntil: 'load' });

        if (pageLoadElement)
            await page.waitForSelector(pageLoadElement, { visible: true, timeout: 1000 * 60 });

        return resolve(page);
    } catch (e) {
        try {
            if (browser)
                browser.close();
        } catch (e) { }
        return reject(e);
    }
});

//https://github.com/vercel/pkg/issues/204#issuecomment-536323464

/*

const downloadURLs = {
  linux: 'https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/%d/chrome-linux.zip',
  mac: 'https://storage.googleapis.com/chromium-browser-snapshots/Mac/%d/chrome-mac.zip',
  win32: 'https://storage.googleapis.com/chromium-browser-snapshots/Win/%d/chrome-win32.zip',
  win64: 'https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/%d/chrome-win32.zip',
};


*/


// Support for pkg

/*    
    const download = require('download-chromium');
    const os = require('os');
    const tmp = os.tmpdir();
    console.log(executablePath);        

    const exec = download({
        revision: 869685,
        installPath: executablePath}).then(()=>{
            console.log(exec);
        })
*/

/*
module.exports = class {
    username = "";
    password = "";
    date = "";      // MM-dd-yyyy
    fromTime = "";  // in 24 hour format HH:mm
    toTime = "";    // in 24 hour format HH:mm
    constructor(username, password, date, fromTime, toTime){
        this.username = username;
        this.password = password;
        this.date = date;
        this.fromTime = fromTime;
        this.toTime = toTime;
    }
    init(){
        return new Promise(async (resolve, reject) => {
            try {
                const browser = await puppeteer.launch({
                    executablePath,
                    headless: false,
                    defaultViewport: null,
                    args: ['--start-maximized'],
                    ignoreHTTPSErrors:true
                });
                const page = await browser.newPage();
                await page.goto('https://atram.ir');
                await page.screenshot({ path: 'screenshot.png' });
                
                return resolve(urls);
            } catch (e) {
                return reject(e);
            }   
        });     
    }
}
*/