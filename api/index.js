const express = require('express');
const cloudinary = require('cloudinary').v2;
const app = express();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.VITE_CLOUDINARY_API_KEY,
    api_secret: process.env.VITE_CLOUDINARY_API_SECRET
});

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Endpoint to get all images from the wedding-gallery folder
app.get('/api/get-gallery-images', async (req, res) => {
    try {
        // Get all resources from the wedding-gallery folder
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'wedding-gallery/',
            max_results: 500,
            context: true,
            metadata: true
        });

        res.json(result.resources);
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({ error: 'Failed to fetch images' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
