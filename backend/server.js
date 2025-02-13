require("dotenv").config();
const express = require("express");
const puppeteer = require("puppeteer-extra");
const cors = require("cors");
const app = express();

app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"], 
}));

app.use(express.json());

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

let browser;

const getBrowserInstance = async () => {
    if (!browser || !browser.isConnected()) {
        console.warn("⚠️ Browser instance is closed. Restarting...");
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
            ],
        });
    }
    return browser;
};

const scrapeAllText = async (url) => {
    const divSelector = ".index-module_foldText_TFDUn .index-module_text_HePJ3 .index-module_ellipsisText_pYRbE .can-select.index-module_sourceTitle_TuTtw";
    console.log("🔍 Scraping all text content from div:", divSelector, "at", url);
    
    if (typeof url !== "string" || !url.startsWith("http")) {
        console.error("❌ Invalid URL provided:", url);
        return null;
    }
    
    let browser;
    let page;
    try {
        browser = await getBrowserInstance();
        page = await browser.newPage();

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 100000 });
        await page.waitForSelector(divSelector, { timeout: 1000000 });

        const divText = await page.evaluate((selector) => {
            const targetDiv = document.querySelector(selector);
            return targetDiv ? targetDiv.innerText.replace(/\s+/g, ' ').trim() : "No text found";
        }, divSelector);

        console.log("✅ Extracted text content:", divText ? divText.substring(0, 200) : "No text found");
    
        return divText;
    } catch (error) {
        console.error(`❌ Error scraping ${url}: ${error.message}`);
        return null;
    } finally {
        if (page) await page.close();
    }
};


app.post("/scrape", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "URL is required!" });
    }

    try {
        const allText = await scrapeAllText(url);

        if (allText) {
            res.json({ allText });
        } else {
            res.status(404).json({ error: "Text content not found" });
        }
    } catch (err) {
        console.error("❌ Error during scrape:", err);
        res.status(500).json({ error: "Failed to scrape the content" });
    }
});

app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));

