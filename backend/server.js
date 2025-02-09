require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const xlsx = require("xlsx");
const path = require("path");
const axios = require("axios");
//const puppeteer = require("puppeteer");
const puppeteer = require("puppeteer-extra"); 
const cloudinary = require("cloudinary").v2;
const ProgressBar = require("progress");
const upload = require('multer')({ dest: 'uploads/' });
const app = express();
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"], 
}));

app.use(express.json());

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const scrapeImage = async (url) => {
    console.log("Launching Puppeteer...");

    const browser = await puppeteer.launch({
        headless: "new", 
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu"
        ],
    });

    const page = await browser.newPage();

    try {
        console.log("Navigating to URL:", url);
        await page.goto(url, { waitUntil: "load", timeout: 60000 });

        await page.waitForSelector("img", { timeout: 10000 });

        const imageUrls = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("img"))
                .map(img => img.src)
                .filter(src => /https:\/\/xcimg\.szwego\.com\/.*\.(jpg|jpeg|png|gif)\?/.test(src)); 
        });

        const firstThreeImageUrls = imageUrls.slice(0, 3);

        const validImageUrls = await Promise.all(firstThreeImageUrls.map(async (imageUrl) => {
            try {
                const response = await axios.head(imageUrl);
                return response.status === 200 ? imageUrl : null;
            } catch (error) {
                console.log(`❌ Invalid image URL: ${imageUrl}`);
                return null;
            }
        }));

        const finalValidImageUrls = validImageUrls.filter(url => url !== null);

        console.log("Valid image URLs:", finalValidImageUrls);
        await browser.close();
        return finalValidImageUrls;
    } catch (error) {
        console.log(`❌ Failed to scrape ${url}: ${error.message}`);
        await browser.close();
          //await page.close();
        return [];
    }
};

const uploadToCloudinary = async (filePath) => {
    try {
        const result = await cloudinary.uploader.upload(filePath, { folder: "scraped_images" });
        console.log("📤 Cloudinary upload successful:", result.secure_url);
        return result.secure_url;
    } catch (error) {
        console.log(`❌ Cloudinary upload failed: ${error.message}`);
        return null;
    }
};

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded!" });

    console.log("File uploaded:", req.file);
    const filePath = req.file.path;

    const workbook = xlsx.readFile(filePath, { cellStyles: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    let data = xlsx.utils.sheet_to_json(worksheet, { defval: "" }); 
    //console.log('Parsed data:', data); 
    console.log(`📦 Total links found: ${data.length}\n`);

    const limit = parseInt(req.query.limit, 10) || data.length;
    //console.log(`⚡ Processing ${limit} out of ${data.length} links...\n`);

    let newData = [];

    const promises = data.slice().map(async (row, index) => {
        if (!row.LINKS || !row.LINKS.trim()) {
            //console.log(`❌ Empty or invalid link found at row ${index + 1}`);
            return;  
        }

        console.log(`🔍 Processing link ${index + 1}: ${row.LINKS}`);

        try {
            const imageUrls = await scrapeImage(row.LINKS);

            if (imageUrls.length > 0) {
                const cloudinaryUrls = await Promise.all(imageUrls.map(async (imageUrl) => {
                    const cloudinaryUrl = await uploadToCloudinary(imageUrl);
                    return cloudinaryUrl ? cloudinaryUrl : 'Cloudinary Upload Failed';
                }));

                let newRow = { ...row, 'Image Src': cloudinaryUrls[0] };
                newData.push(newRow);

                for (let j = 1; j < cloudinaryUrls.length; j++) {
                    let newRowForAdditionalImage = { ...row, 'Image Src': cloudinaryUrls[j] };
                    newData.push(newRowForAdditionalImage);
                }
            } else {
                let newRow = { ...row, 'Image Src': 'No Image Found' };
                newData.push(newRow);
            }
        } catch (err) {
            console.error(`Error processing link at row ${index + 1}:`, err);
            let newRow = { ...row, 'Image Src': 'Error occurred' };
            newData.push(newRow);
        }
    });

    await Promise.all(promises);

    const newWorksheet = xlsx.utils.json_to_sheet(newData, { origin: "A1" });

    Object.keys(newWorksheet).forEach(cell => {
        if (!cell.startsWith("!")) {
            worksheet[cell] = newWorksheet[cell];
        }
    });

    const outputFilePath = `uploads/processed_${Date.now()}.xlsx`;
    console.log(`⚡ Writing the workbook to ${outputFilePath}`);

    xlsx.writeFile(workbook, outputFilePath);
    console.log(`✅ File successfully written to ${outputFilePath}`);

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Error deleting the original file:', err);
        }
    });

    const processedFileName = outputFilePath.split('/').pop(); 
    res.json({ fileName: processedFileName });
});





app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
