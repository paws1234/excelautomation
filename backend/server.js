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
    if (!browser) {
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
    console.log("🔍 Scraping all text content from:", url);

    const browser = await getBrowserInstance();
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 100000 });

        await page.waitForSelector("body", { timeout: 10000 });

        const allText = await page.evaluate(() => {
            return document.body.innerText; 
        });

        console.log("✅ Extracted all text content:", allText.substring(0, 200)); 

        await page.close();
        await browser.close(); 

        return allText;
    } catch (error) {
        console.error(`❌ Error scraping ${url}: ${error.message}`);

        await page.close();
        await browser.close();

        return null;
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

