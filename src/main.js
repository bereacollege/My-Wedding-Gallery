import './style.css'
import lightGallery from 'lightgallery'
import lgThumbnail from 'lightgallery/plugins/thumbnail'
import 'lightgallery/css/lightgallery.css'
import 'lightgallery/css/lg-thumbnail.css'

// Initialize gallery variables
const galleryContainer = document.getElementById('lightgallery');
const galleryItems = [];
let gallery;

// Theme toggle
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.body.classList.add(prefersDark ? 'dark-theme' : 'light-theme');

const themeBtn = document.createElement('button');
themeBtn.textContent = prefersDark ? '🌙' : '☀️';
themeBtn.title = 'Toggle light/dark mode';
themeBtn.style.position = 'fixed';
themeBtn.style.top = '1em';
themeBtn.style.right = '1em';
themeBtn.style.zIndex = 100;
themeBtn.style.background = '#fff';
themeBtn.style.border = '1px solid #ccc';
themeBtn.style.borderRadius = '50%';
themeBtn.style.width = '40px';
themeBtn.style.height = '40px';
themeBtn.style.cursor = 'pointer';
themeBtn.onclick = () => {
    const isDark = document.body.classList.contains('dark-theme');
    document.body.classList.remove(isDark ? 'dark-theme' : 'light-theme');
    document.body.classList.add(isDark ? 'light-theme' : 'dark-theme');
    themeBtn.textContent = isDark ? '☀️' : '🌙';
};
document.body.appendChild(themeBtn);

// Initialize Cloudinary Upload Widget
const uploadWidget = cloudinary.createUploadWidget(
    {
        cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
        uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET,
        folder: 'wedding-gallery',
        tags: ['wedding'],
        maxFiles: 20,
        sources: ['local', 'camera', 'url'],
        showAdvancedOptions: false,
        cropping: false,
        multiple: true,
        defaultSource: 'local',
        resourceType: 'image',
        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'heic', 'heif'],
        maxFileSize: 10000000, // 10MB in bytes
        styles: {
            palette: {
                window: '#FFFFFF',
                windowBorder: '#90A0B3',
                tabIcon: '#0078FF',
                menuIcons: '#5A616A',
                textDark: '#000000',
                textLight: '#FFFFFF',
                link: '#0078FF',
                action: '#FF620C',
                inactiveTabIcon: '#0E2F5A',
                error: '#F44235',
                inProgress: '#0078FF',
                complete: '#20B832',
                sourceBg: '#E4EBF1'
            }
        }
    },
    (error, result) => {
        if (!error && result && result.event === 'success') {
            console.log('Upload success:', result.info);
            
            // Get the optimized URL from Cloudinary
            const imageUrl = result.info.secure_url;
            
            // Add metadata for the gallery
            const metadata = {
                name: guestName, // Use the collected guest name
                filename: result.info.original_filename,
                timestamp: new Date().toISOString()
            };
            
            // Add to gallery and show thank you message
            addToGallery(imageUrl, false, metadata);
            showThankYou();
            
            // Log success
            console.log('Added to gallery:', imageUrl);
        }
    }
);

// Cache management
const CACHE_KEY = 'wedding_gallery_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

function saveToCache(images) {
    const cacheData = {
        timestamp: new Date().getTime(),
        images: images
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
}

function getFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached) return null;

        const cacheData = JSON.parse(cached);
        const now = new Date().getTime();

        // Check if cache is still valid
        if (now - cacheData.timestamp > CACHE_DURATION) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }

        return cacheData.images;
    } catch (error) {
        console.error('Cache error:', error);
        return null;
    }
}

// Function to load existing images from Cloudinary
async function loadExistingImages() {
    try {
        // Clear existing error messages if any
        const existingError = galleryContainer.querySelector('.gallery-error');
        if (existingError) {
            existingError.remove();
        }

        // Show loading state
        const loadingEl = document.createElement('div');
        loadingEl.className = 'gallery-loading';
        loadingEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Loading wedding memories...</p>
        `;
        galleryContainer.appendChild(loadingEl);

        // Try to get images from cache first
        let images = getFromCache();
        
        if (!images) {
            // If not in cache, fetch from server
            const response = await fetch('/api/get-gallery-images');
            if (!response.ok) {
                throw new Error('Failed to fetch images');
            }

            images = await response.json();
            
            // Save to cache
            saveToCache(images);
        }
        
        // Remove loading state
        loadingEl.remove();

        // Clear the gallery container before adding new images
        galleryContainer.innerHTML = '';

        // Sort images by timestamp (newest first)
        images.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Add each image to the gallery
        for (const image of images) {
            const metadata = {
                name: image.context?.custom?.contributor || 'Wedding Guest',
                timestamp: image.created_at,
                filename: image.filename
            };

            addToGallery(image.secure_url, false, metadata);
        }

        // Update the photo count
        updatePhotoCount();
        
    } catch (error) {
        console.error('Error loading existing images:', error);
        
        // Try to get images from cache as fallback
        const cachedImages = getFromCache();
        if (cachedImages) {
            // If we have cached images, use them instead
            console.log('Using cached images as fallback');
            for (const image of cachedImages) {
                const metadata = {
                    name: image.context?.custom?.contributor || 'Wedding Guest',
                    timestamp: image.created_at,
                    filename: image.filename
                };
                addToGallery(image.secure_url, false, metadata);
            }
        }
    }
}

// Sort and filter functions
function sortGalleryItems(method) {
    galleryItems.sort((a, b) => {
        switch(method) {
            case 'newest':
                return new Date(b.timestamp) - new Date(a.timestamp);
            case 'oldest':
                return new Date(a.timestamp) - new Date(b.timestamp);
            case 'name':
                return (a.metadata?.name || '').localeCompare(b.metadata?.name || '');
            default:
                return 0;
        }
    });
}

function filterGalleryItems(searchTerm) {
    return galleryItems.filter(item => {
        const name = item.metadata?.name?.toLowerCase() || '';
        return name.includes(searchTerm.toLowerCase());
    });
}

function updateGallery() {
    // Clear existing gallery
    galleryContainer.innerHTML = '';
    
    // Get current filter and sort values
    const sortMethod = document.getElementById('sort-select').value;
    const filterTerm = document.getElementById('filter-input').value;
    
    // Sort items
    sortGalleryItems(sortMethod);
    
    // Filter items
    const filteredItems = filterGalleryItems(filterTerm);
    
    // Update photo count
    document.getElementById('photo-count').textContent = `${filteredItems.length} photos`;
    
    // Add filtered and sorted items to gallery
    filteredItems.forEach(item => {
        const a = document.createElement('a');
        a.href = item.src;
        a.className = 'gallery-item';
        
        const img = document.createElement('img');
        img.src = item.thumb;
        img.alt = item.metadata?.name || 'Wedding photo';
        
        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s';
        img.onload = () => {
            img.style.opacity = '1';
        };
        
        a.appendChild(img);
        galleryContainer.appendChild(a);
    });
    
    // Refresh LightGallery
    if (gallery) {
        gallery.refresh();
    }
}

// Initialize everything when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize gallery first
    initGallery();
    
    // Then load existing images
    loadExistingImages();
    
    // Set up event listeners for controls
    document.getElementById('sort-select').addEventListener('change', updateGallery);
    document.getElementById('filter-input').addEventListener('input', updateGallery);
});

// Function to show name input modal
function showNameInputModal() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'name-modal';
        modal.innerHTML = `
            <div class="name-modal-content">
                <h2>Share Your Name</h2>
                <p>Please share your name so we can credit your beautiful photos in our gallery.</p>
                <input type="text" 
                       class="name-input" 
                       placeholder="Your name"
                       maxlength="50"
                       autocomplete="name">
                <button class="name-submit" disabled>Continue to Upload</button>
            </div>
        `;

        const input = modal.querySelector('.name-input');
        const submitBtn = modal.querySelector('.name-submit');

        // Enable/disable submit button based on input
        input.addEventListener('input', () => {
            submitBtn.disabled = !input.value.trim();
        });

        // Handle form submission
        submitBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (name) {
                modal.remove();
                resolve(name);
            }
        });

        // Also submit on Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                modal.remove();
                resolve(input.value.trim());
            }
        });

        document.body.appendChild(modal);
        input.focus();
    });
}

// Store the guest's name
let guestName = '';

// Attach upload widget to button
document.getElementById('camera-upload').addEventListener('click', async () => {
    // If we don't have the guest's name yet, ask for it
    if (!guestName) {
        guestName = await showNameInputModal();
    }
    
    // Only open upload widget if we have a name
    if (guestName) {
        uploadWidget.open();
    }
});

// Upload and preview are handled by Cloudinary Widget

// Gallery helper functions
function showPreviewModal(previewUrl, file) {
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-content">
            <img src="${previewUrl}" alt="Preview">
            <div class="preview-controls">
                <button class="confirm-upload">Yes, Include This</button>
                <button class="cancel-upload">No, Skip This</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.confirm-upload').onclick = () => {
        modal.remove();
        URL.revokeObjectURL(previewUrl);
    };
    
    modal.querySelector('.cancel-upload').onclick = () => {
        modal.remove();
        URL.revokeObjectURL(previewUrl);
    };
}

function addToGallery(url, isVideo, metadata = {}) {
    // Create the gallery item
    const timestamp = metadata.timestamp || new Date().toISOString();
    const galleryItem = {
        src: url,
        thumb: url,
        timestamp: timestamp,
        metadata: metadata,
        subHtml: `<div class="lightGallery-captions">
            ${metadata.name ? `<p>Shared by: ${metadata.name}</p>` : ''}
            <p>Uploaded: ${new Date(timestamp).toLocaleDateString()}</p>
        </div>`
    };
    
    // Add to our items array
    galleryItems.push(galleryItem);
    
    // Create the thumbnail element with data attributes for lightGallery
    const a = document.createElement('a');
    a.href = url;
    a.className = 'gallery-item';
    a.setAttribute('data-src', url);
    a.setAttribute('data-sub-html', galleryItem.subHtml);
    
    const img = document.createElement('img');
    img.src = url;
    img.alt = metadata.name || 'Wedding photo';
    img.className = 'gallery-img';
    
    // Add loading animation
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.3s';
    img.onload = () => {
        img.style.opacity = '1';
    };
    
    a.appendChild(img);
    galleryContainer.appendChild(a);
    
    // Refresh LightGallery if it exists
    if (gallery) {
        gallery.refresh();
        console.log('Gallery refreshed with new image:', url);
    } else {
        // Try to initialize gallery if it's not initialized
        gallery = initGallery();
        if (gallery) {
            gallery.refresh();
            console.log('Gallery initialized and refreshed with new image:', url);
        } else {
            console.warn('Could not initialize gallery');
        }
    }
}

function showThankYou() {
    const popup = document.createElement('div');
    popup.className = 'thank-you-popup';
    popup.textContent = 'Thank You!';
    document.body.appendChild(popup);
    setTimeout(() => {
        popup.classList.add('fade-out');
        setTimeout(() => popup.remove(), 2000);
    }, 1200);
}

// Initialize gallery
function initGallery() {
    if (!galleryContainer) {
        console.error('Gallery container not found!');
        return;
    }

    // Destroy existing gallery if it exists
    if (gallery) {
        gallery.destroy();
    }

    // Initialize with all current items
    gallery = lightGallery(galleryContainer, {
        plugins: [lgThumbnail],
        speed: 500,
        download: false,
        thumbnail: true,
        animateThumb: true,
        showThumbByDefault: true,
        thumbWidth: 100,
        thumbHeight: '80px',
        thumbMargin: 5,
        mode: 'lg-fade',
        backdropDuration: 400,
        hash: false,
        closable: true,
        showMaximizeIcon: true,
        appendSubHtmlTo: '.lg-item',
        slideDelay: 400,
        selector: '.gallery-item', // Add this to ensure items are clickable
        licenseKey: 'your-license-key', // Remove this line if you don't have a license
        elementClassNames: {
            slideContainer: 'gallery-container',
            thumb: 'gallery-thumb',
        },
        download: false,
        counter: true,
        swipeToClose: true,
        enableSwipe: true,
        enableDrag: true,
        toggleThumb: true,
        thumbHeight: '100px',
        addClass: 'gallery-initialized'
    });
    
    window.gallery = gallery; // Store reference globally
    return gallery;
}

// Initialize gallery when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initGallery();
});

// Styles
const style = document.createElement('style');
style.textContent = `
    .name-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    }
    .name-modal-content {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        text-align: center;
        max-width: 90%;
        width: 400px;
        font-family: 'Cormorant Garamond', serif;
    }
    .name-modal h2 {
        margin: 0 0 1.5rem;
        font-family: 'Cinzel', serif;
        color: var(--primary-color);
        font-size: 1.8rem;
    }
    .name-modal p {
        margin: 0 0 1.5rem;
        font-size: 1.1rem;
        line-height: 1.5;
    }
    .name-input {
        width: 100%;
        padding: 0.8rem;
        margin-bottom: 1.5rem;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 1.1rem;
        font-family: inherit;
    }
    .name-input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 2px rgba(160,82,45,0.1);
    }
    .name-submit {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 1.2rem 2rem;
        border-radius: 6px;
        font-size: 1.1rem;
        cursor: pointer;
        transition: transform 0.2s, background-color 0.2s;
        font-family: inherit;
    }
    .name-submit:hover {
        transform: translateY(-2px);
        background-color: #8B4513;
    }
    .name-submit:disabled {
        background-color: #ccc;
        cursor: not-allowed;
        transform: none;
    }

    /* Dark theme support */
    body.dark-theme .name-modal-content {
        background: #2d2d2d;
        color: #fff;
    }
    body.dark-theme .name-input {
        background: #333;
        border-color: #444;
        color: #fff;
    }
    body.dark-theme .name-submit {
        background: #4CAF50;
    }
    body.dark-theme .name-submit:hover {
        background: #45a049;
    }

    .preview-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    }
    .preview-content {
        max-width: 90%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        background: white;
        padding: 20px;
        border-radius: 10px;
    }
    .preview-content img {
        max-width: 100%;
        max-height: 70vh;
        object-fit: contain;
    }
    .preview-controls {
        display: flex;
        gap: 10px;
    }
    .preview-controls button {
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-family: inherit;
        font-size: 1rem;
    }
    .confirm-upload {
        background: #4CAF50;
        color: white;
    }
    .cancel-upload {
        background: #f44336;
        color: white;
    }
    .thank-you-popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(76, 175, 80, 0.9);
        color: white;
        padding: 20px 40px;
        border-radius: 10px;
        font-size: 1.5rem;
        z-index: 10001;
    }
    .thank-you-popup.fade-out {
        opacity: 0;
        transition: opacity 0.5s ease-out;
    }

    /* Gallery Loading States */
    .gallery-loading {
        text-align: center;
        padding: 3rem;
        font-family: 'Cormorant Garamond', serif;
    }

    .loading-spinner {
        width: 50px;
        height: 50px;
        margin: 0 auto 1rem;
        border: 3px solid #ffffffff;
        border-top: 3px solid var(--primary-color);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .gallery-loading p {
        font-size: 1.2rem;
        color: var(--primary-color);
        margin: 0;
    }

    .gallery-error {
        text-align: center;
        padding: 3rem;
        font-family: 'Cormorant Garamond', serif;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.1);
        margin: 2rem auto;
        max-width: 600px;
    }

    .gallery-error p {
        font-size: 1.2rem;
        color: var(--primary-color);
        margin: 0 0 1rem;
    }

    .gallery-error .error-subtitle {
        font-size: 1rem;
        color: #666;
        margin-bottom: 1.5rem;
    }

    .gallery-error button {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.8rem 2rem;
        border-radius: 6px;
        font-size: 1.1rem;
        cursor: pointer;
        transition: all 0.3s ease;
        font-family: inherit;
        border: 2px solid transparent;
    }

    .gallery-error button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(160,82,45,0.2);
    }

    /* Dark theme support */
    body.dark-theme .gallery-error {
        background: rgba(45, 45, 45, 0.95);
    }

    body.dark-theme .gallery-error p {
        color: #fff;
    }

    body.dark-theme .gallery-error .error-subtitle {
        color: #aaa;
    }

    body.dark-theme .gallery-error button {
        background: #4CAF50;
    }

    body.dark-theme .gallery-error button:hover {
        background: #45a049;
    }

    /* Dark theme support */
    body.dark-theme .loading-spinner {
        border-color: #0a0a0aff;
        border-top-color: var(--primary-color);
    }

    body.dark-theme .gallery-loading p {
        color: #fff;
    }

    body.dark-theme .gallery-error p {
        color: #ff8a80;
    }
`;
document.head.appendChild(style);
