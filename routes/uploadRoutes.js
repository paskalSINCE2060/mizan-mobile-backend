const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');

router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // Construct full URL for the image
    const fullUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    res.status(200).json({ imageUrl: fullUrl });
});

module.exports = router;
