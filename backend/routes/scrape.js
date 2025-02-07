const express = require('express');
const router = express.Router();
const upload = require('multer')().single('file');  // Use multer middleware for file upload
const scrapeController = require('../controllers/scrapeController');

router.post('/scrape', upload, scrapeController.scrapeData);

module.exports = router;
