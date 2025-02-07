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

        // Wait for images to be loaded
        await page.waitForSelector("img", { timeout: 10000 });

        // Extract image URLs and filter for specific URLs matching the regex
        const imageUrls = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("img"))
                .map(img => img.src)
                .filter(src => /https:\/\/xcimg\.szwego\.com\/.*\.(jpg|jpeg|png|gif)\?/.test(src)); // Filter by regex for specific image URLs
        });

        // Get only the first 3 image URLs
        const firstThreeImageUrls = imageUrls.slice(0, 3);

        // Filter out invalid image URLs (e.g., 404 errors)
        const validImageUrls = await Promise.all(firstThreeImageUrls.map(async (imageUrl) => {
            try {
                const response = await axios.head(imageUrl);
                return response.status === 200 ? imageUrl : null;
            } catch (error) {
                console.log(`❌ Invalid image URL: ${imageUrl}`);
                return null;
            }
        }));

        // Remove any null values from the array
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

    // Read the workbook without converting to JSON (to retain format)
    const workbook = xlsx.readFile(filePath, { cellStyles: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert worksheet to JSON
    let data = xlsx.utils.sheet_to_json(worksheet, { defval: "" }); // Preserve empty cells

    console.log(`📦 Total links found: ${data.length}\n`);

    // Get the processing limit from the query parameter (default to all links if not specified)
    const limit = parseInt(req.query.limit, 10) || data.length;
    console.log(`⚡ Processing ${limit} out of ${data.length} links...\n`);

    let newData = []; // New array to store processed rows

    for (let i = 0; i < Math.min(limit, data.length); i++) {
        if (data[i].LINKS) {
            console.log(`🔍 Processing: ${data[i].LINKS}`);
            const imageUrls = await scrapeImage(data[i].LINKS);

            if (imageUrls.length > 0) {
                // Upload each image to Cloudinary and create a new row for each Cloudinary URL
                const cloudinaryUrls = await Promise.all(imageUrls.map(async (imageUrl) => {
                    const cloudinaryUrl = await uploadToCloudinary(imageUrl);
                    return cloudinaryUrl ? cloudinaryUrl : 'Cloudinary Upload Failed';
                }));

                // Add Cloudinary URLs to the "Image Src" column for the first image
                let newRow = { ...data[i], 'Image Src': cloudinaryUrls[0] }; // First URL in the row
                newData.push(newRow);

                // Create new rows for any additional Cloudinary URLs
                for (let j = 1; j < cloudinaryUrls.length; j++) {
                    let newRowForAdditionalImage = { ...data[i], 'Image Src': cloudinaryUrls[j] };
                    newData.push(newRowForAdditionalImage);
                }
            } else {
                // If no images found, push the row with an empty 'Image Src'
                let newRow = { ...data[i], 'Image Src': 'No Image Found' };
                newData.push(newRow);
            }
        } else {
            newData.push(data[i]);
        }
    }

    const newWorksheet = xlsx.utils.json_to_sheet(newData, { origin: "A1" });

    Object.keys(newWorksheet).forEach(cell => {
        if (!cell.startsWith("!")) {
            worksheet[cell] = newWorksheet[cell];
        }
    });

      const outputFilePath = `uploads/processed_${Date.now()}.xlsx`;
    console.log(`⚡ Writing the workbook to ${outputFilePath}`);

    xlsx.writeFile(workbook, outputFilePath );
    console.log(`✅ File successfully written to ${outputFilePath}`);



fs.unlink(filePath, (err) => {
    if (err) {
        console.error('Error deleting the original file:', err);
    }
});
    
res.download(outputFilePath, "processed.xlsx", () => {
    console.log(`✅ File downloaded. Cleaning up...`);

    fs.unlinkSync(outputFilePath, (err) => {
        if (err) {
            console.error('Error deleting the processed file:', err);
        } else {
            console.log(`🗑 Processed file ${outputFilePath} deleted after download.`);
        }
    });
});
});





app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
