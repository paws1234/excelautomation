const playwright = require('playwright');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const XLSX = require('xlsx');

// Cloudinary Configuration
cloudinary.config({
  cloud_name: 'your-cloud-name',
  api_key: 'your-api-key',
  api_secret: 'your-api-secret',
});

const scrapeData = async (req, res) => {
  try {
    // Read the uploaded Excel file
    const file = req.file;
    if (!file) {
      return res.status(400).send({ message: 'No file uploaded' });
    }

    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Limit the number of rows to process (e.g., first 3 links)
    const LIMIT = 3;  // Set the limit to 3 (can be changed or commented out for no limit)
    const limitedData = data.slice(0, LIMIT); // Only process the first 3 rows

    const updatedData = [];
    for (let row of limitedData) {
      try {
        const link = row.LINKS;
        const imageUrl = await scrapeImage(link);
        const cloudinaryUrl = await uploadToCloudinary(imageUrl);

        updatedData.push({ ...row, image_url: cloudinaryUrl });
      } catch (err) {
        updatedData.push({ ...row, image_url: 'Error scraping/uploading' });
      }
    }

    // Write back the updated data to an Excel file
    const updatedSheet = XLSX.utils.json_to_sheet(updatedData);
    workbook.Sheets[sheetName] = updatedSheet;
    const updatedFilePath = 'uploads/updated_' + file.filename;
    XLSX.writeFile(workbook, updatedFilePath);

    // Send the updated file back
    res.download(updatedFilePath, 'updated_file.xlsx', (err) => {
      if (err) {
        return res.status(500).send({ message: 'Error sending the file' });
      }
      // Clean up uploaded file after response
      fs.unlinkSync(file.path);
      fs.unlinkSync(updatedFilePath);
    });
  } catch (err) {
    return res.status(500).send({ message: 'Error scraping data' });
  }
};

// Scrape image from a URL using Playwright
const scrapeImage = async (url) => {
  try {
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    await page.goto(url);
    const imageUrl = await page.getAttribute('img', 'src');  // You can adjust this depending on the image selector
    await browser.close();
    if (!imageUrl) {
      throw new Error('No image found on the page');
    }
    return imageUrl;
  } catch (err) {
    throw new Error(`Failed to scrape image from ${url}`);
  }
};

// Upload image to Cloudinary
const uploadToCloudinary = async (imageUrl) => {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'scraped_images',
    });
    return result.secure_url;
  } catch (err) {
    throw new Error('Failed to upload image to Cloudinary');
  }
};

module.exports = { scrapeData };
