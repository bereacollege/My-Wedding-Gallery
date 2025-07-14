import './style.css'

import Uppy from '@uppy/core'
import Dashboard from '@uppy/dashboard'
import '@uppy/core/dist/style.min.css'
import '@uppy/dashboard/dist/style.min.css'
import lightGallery from 'lightgallery'
import lgThumbnail from 'lightgallery/plugins/thumbnail'
import 'lightgallery/css/lightgallery.css'
import 'lightgallery/css/lg-thumbnail.css'

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

// Uppy setup
let uppy = new Uppy({
    restrictions: {
        maxNumberOfFiles: 20,
        allowedFileTypes: [
            'image/jpeg',
            'image/png',
            'image/heic',
            'image/heif',
            'video/mp4',
            'video/quicktime',
            'video/mov'
        ],
        maxFileSize: 100 * 1024 * 1024 // 100MB max file size
    },
    autoProceed: false,
    allowMultipleUploadBatches: false // Prevent files from previous uploads staying in the list
});

uppy.use(Dashboard, {
    trigger: '#camera-upload',
    inline: false,
    closeModalOnClickOutside: true,
    showProgressDetails: true,
    proudlyDisplayPoweredByUppy: false,
    note: 'Share your photos and videos (up to 100MB each)',
    metaFields: [
        { id: 'name', name: 'Your Name', placeholder: 'Optional: Add your name' }
    ],
    showRemoveButtonAfterComplete: true,
    browserBackButtonClose: true,
    disableStatusBar: false,
    animateOpenClose: true
});

// Always start with a clean slate when opening Uppy
const cameraBtn = document.getElementById('camera-upload');
if (cameraBtn) {
    cameraBtn.addEventListener('click', () => {
        // First, clear everything
        uppy.cancelAll();
        uppy.clearUploadedFiles();
        uppy.reset();
        
        // Force a fresh state
        const dashboard = uppy.getPlugin('Dashboard');
        if (dashboard) {
            dashboard.closeModal();
            // Small delay to ensure complete reset
            setTimeout(() => {
                uppy = new Uppy({
                    ...uppy.opts,
                    allowMultipleUploadBatches: false
                });
                dashboard.openModal();
            }, 100);
        }
    });
}

// Preview step
let currentPreviewUrl = null;

uppy.on('file-added', (file) => {
    // Create preview URL
    currentPreviewUrl = URL.createObjectURL(file.data);
    
    // Show preview modal
    const previewModal = document.createElement('div');
    previewModal.className = 'preview-modal';
    previewModal.innerHTML = `
        <div class="preview-content">
            ${file.type.startsWith('video/') 
                ? `<video src="${currentPreviewUrl}" controls></video>`
                : `<img src="${currentPreviewUrl}" alt="Preview">`}
            <div class="preview-controls">
                <button class="confirm-upload">Yes, Include This</button>
                <button class="cancel-upload">No, Skip This</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(previewModal);
    
    // Handle preview actions
    previewModal.querySelector('.confirm-upload').onclick = () => {
        previewModal.remove();
        URL.revokeObjectURL(currentPreviewUrl);
        // Instead of uploading, just close the preview and keep the file
        const dashboard = uppy.getPlugin('Dashboard');
        if (dashboard) dashboard.openModal();
    };
    
    previewModal.querySelector('.cancel-upload').onclick = () => {
        previewModal.remove();
        URL.revokeObjectURL(currentPreviewUrl);
        uppy.removeFile(file.id);
        const dashboard = uppy.getPlugin('Dashboard');
        if (dashboard) dashboard.openModal();
    };
});

// Clean up after successful upload
uppy.on('complete', (result) => {
    // Process successful uploads
    result.successful.forEach(file => {
        const isVideo = file.type.startsWith('video/');
        const localUrl = URL.createObjectURL(file.data);
        addToGallery(localUrl, isVideo, file.meta);
        
        if (typeof uploadToWasabi === 'function') {
            uploadToWasabi(file)
                .then(wasabiUrl => updateGalleryItemUrl(localUrl, wasabiUrl))
                .catch(error => console.warn('Backup to Wasabi failed, but file is available in gallery:', error));
        }
    });
    
    showThankYou();
    
    // Complete cleanup
    const dashboard = uppy.getPlugin('Dashboard');
    if (dashboard) {
        dashboard.closeModal();
    }
    uppy.cancelAll();
    uppy.clearUploadedFiles();
    uppy.reset();
});

// Handle modal close with cleanup
uppy.on('dashboard:modal-closed', () => {
    uppy.cancelAll();
    uppy.clearUploadedFiles();
    uppy.reset();
});

const galleryContainer = document.getElementById('lightgallery');
let galleryItems = [];

// Helper functions
function addToGallery(url, isVideo, metadata = {}) {
    galleryItems.push({
        src: url,
        thumb: url,
        subHtml: `<div class="lightGallery-captions">
            ${metadata.name ? `<p>Shared by: ${metadata.name}</p>` : ''}
            <p>Uploaded: ${new Date().toLocaleDateString()}</p>
        </div>`
    });
    
    addImageToGallery(url, isVideo);
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

function addImageToGallery(url, isVideo = false) {
    const a = document.createElement('a');
    a.href = url;
    a.className = 'gallery-item';
    
    if (isVideo) {
        a.setAttribute('data-video', `{"source": [{"src":"${url}", "type":"video/mp4"}], "attributes": {"preload": false, "controls": true}}`);
    }

    const img = document.createElement(isVideo ? 'video' : 'img');
    img.src = url;
    if (isVideo) {
        img.setAttribute('preload', 'metadata');
    }
    
    a.appendChild(img);
    galleryContainer.appendChild(a);
    
    // Refresh light gallery
    if (window.gallery) {
        window.gallery.refresh();
    }
}

// Update gallery item URLs when Wasabi upload completes
function updateGalleryItemUrl(localUrl, wasabiUrl) {
    const itemIndex = galleryItems.findIndex(item => item.src === localUrl);
    if (itemIndex !== -1) {
        galleryItems[itemIndex].src = wasabiUrl;
        galleryItems[itemIndex].thumb = wasabiUrl;
    }
    
    // Update DOM element
    const galleryItem = Array.from(galleryContainer.getElementsByTagName('a'))
        .find(a => a.href === localUrl);
    if (galleryItem) {
        galleryItem.href = wasabiUrl;
        const media = galleryItem.querySelector('img, video');
        if (media) media.src = wasabiUrl;
    }
}

// Initialize light gallery for the container
window.gallery = lightGallery(galleryContainer, {
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
    container: galleryContainer,
    hash: false,
    closable: true,
    showMaximizeIcon: true,
    appendSubHtmlTo: '.lg-item',
    slideDelay: 400
});

// Open gallery at specific image or video
function openGalleryAt(startUrl) {
    const index = galleryItems.findIndex(item => item.src === startUrl);
    if (galleryContainer.lightGalleryInstance) {
        galleryContainer.lightGalleryInstance.destroy();
    }
    
    galleryContainer.lightGalleryInstance = lightGallery(galleryContainer, {
        plugins: [lgThumbnail],
        dynamic: true,
        dynamicEl: galleryItems,
        index: Math.max(0, index),
        download: false,
        thumbnail: true,
        animateThumb: true,
        showThumbByDefault: true,
        thumbWidth: 100,
        thumbHeight: '80px',
        thumbMargin: 5,
        mode: 'lg-fade',
        backdropDuration: 400,
        container: galleryContainer,
        hash: false,
        closable: true,
        showMaximizeIcon: true,
        appendSubHtmlTo: '.lg-item',
        slideDelay: 400
    });
    
    galleryContainer.lightGalleryInstance.openGallery();
}

// Add styles for preview modal
const style = document.createElement('style');
style.textContent = `
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
    }
    .preview-content img,
    .preview-content video {
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
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.1rem;
    }
    .confirm-upload {
        background: #4CAF50;
        color: white;
    }
    .cancel-upload {
        background: #f44336;
        color: white;
    }
`;
document.head.appendChild(style);
