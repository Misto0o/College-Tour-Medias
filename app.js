// ────────────── CONFIGURATION ──────────────
const SUPABASE_URL = "https://btydbatrvzjycxhrlzmd.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0eWRiYXRydnpqeWN4aHJsem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzM5NzUsImV4cCI6MjA5NjYwOTk3NX0.pi_yaYWIGkFYmOBJ_oLEs05gr3K3waY9zvu2HsVVkQk";
// THIS IS A PUBLIC KEY WITH RESTRICTED ANON ACCESS TO ONLY THE STORAGE BUCKET. NO OTHER DB OR AUTH PERMISSIONS ARE GRANTED. SAFE FOR CLIENT-SIDE USAGE.
const BUCKET = "college-trip-photos";

let supabaseClient;

// Trip Schedules
const TRIP_TIMELINE = {
    elon: new Date("2026-06-16"),
    app_state: new Date("2026-06-17"),
    unc: new Date("2026-06-18")
    // All colleges unlock simultaneously on the day of the trip to encourage real-time sharing and excitement! Adjust dates as needed for staggered access.
};

const COLLEGE_NAMES = {
    elon: "Elon University",
    app_state: "Appalachian State",
    unc: "UNC Chapel Hill"
};

let currentCollege = "elon";
let selectedFiles = [];

// ────────────── DOM ELEMENTS ──────────────
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const dropZone = document.getElementById('dropZone');
const progressWrap = document.getElementById('uploadProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const targetText = document.getElementById('current-upload-target');

// Initialize State
document.addEventListener("DOMContentLoaded", () => {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    checkTimelineLocks();
    switchTheme(currentCollege);
    loadGallery();
});

// Systematically locks/unlocks access windows across timelines
function checkTimelineLocks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const colleges = [
        {
            key: "elon",
            id: "tab-elon",
            label: "Elon University"
        },
        {
            key: "app_state",
            id: "tab-app",
            label: "Appalachian State"
        },
        {
            key: "unc",
            id: "tab-unc",
            label: "UNC Chapel Hill"
        }
    ];

    for (let i = 0; i < colleges.length; i++) {
        const college = colleges[i];
        const btn = document.getElementById(college.id);

        const unlockDate = TRIP_TIMELINE[college.key];

        if (today < unlockDate) {
            // Future
            btn.classList.add("locked");
            btn.innerText = `${college.label} 🔒`;
        } else {

            const nextCollege = colleges[i + 1];

            if (
                nextCollege &&
                today >= TRIP_TIMELINE[nextCollege.key]
            ) {
                // Completed
                btn.classList.remove("locked");
                btn.innerText = `${college.label} ✅`;
            } else {
                // Current stop
                btn.classList.remove("locked");
                btn.innerText = `${college.label} 📸`;
            }
        }
    }

    updateDropZoneLockState();
}
// Controls dropzone interactivity and messages depending on target status
function updateDropZoneLockState() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetReleaseDate = TRIP_TIMELINE[currentCollege];
    const isLocked = today < targetReleaseDate;
    const dropZoneContent = document.getElementById('dropZoneContent');

    if (isLocked) {
        dropZone.classList.add('locked-zone');

        // ─── THE FIX: Completely lock the file input element ───
        fileInput.disabled = true;

        selectedFiles = [];
        uploadBtn.style.display = 'none';
        fileInput.value = '';

        const formattedDate = targetReleaseDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
        dropZoneContent.innerHTML = `
            <div class="fs-1 mb-2">🔒</div>
            <p class="fs-5 fw-semibold text-danger mb-1">Folder Locked</p>
            <p class="small text-muted mb-0">Uploads unlock on schedule: <strong>${formattedDate}</strong></p>
        `;
    } else {
        dropZone.classList.remove('locked-zone');

        // ─── THE FIX: Re-enable the file input element when unlocked ───
        fileInput.disabled = false;

        dropZoneContent.innerHTML = `
            <div class="fs-1 mb-2">📷</div>
            <p class="fs-5 fw-semibold text-secondary mb-1">Tap to choose photos</p>
            <p class="small text-muted mb-0">or drag & drop them here</p>
        `;
    }
}

// Intercepts click handler triggers if user attempts interaction on a locked dropzone
dropZone.addEventListener('click', (e) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < TRIP_TIMELINE[currentCollege]) {
        showToast("This college folder is currently locked!");
        return;
    }
    fileInput.click();
});

// Update standard listener actions to respect active timeline locks
dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (today >= TRIP_TIMELINE[currentCollege]) {
        dropZone.classList.add('drag-over');
    }
});

dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (today < TRIP_TIMELINE[currentCollege]) {
        showToast("This folder is locked!");
        return;
    }

    selectedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    uploadBtn.style.display = selectedFiles.length ? 'inline-block' : 'none';
});

// Handle view switching tabs cleanly
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        // Remove class restrictions so advisors/users can view pre-existing gallery data
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        currentCollege = e.target.dataset.college;
        const cleanName = COLLEGE_NAMES[currentCollege];

        targetText.textContent = cleanName;
        document.getElementById('galleryTitle').innerText =
            `${cleanName} Gallery`;

        switchTheme(currentCollege);
        updateDropZoneLockState();
        loadGallery();
    });
});

function switchTheme(college) {
    document.body.className = '';
    document.body.classList.add(`theme-${college}`);
}

// ────────────── HANDLERS & DROPZONE ──────────────
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    selectedFiles = Array.from(fileInput.files);
    uploadBtn.style.display = selectedFiles.length ? 'inline-block' : 'none';
});

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    selectedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    uploadBtn.style.display = selectedFiles.length ? 'inline-block' : 'none';
});

// ────────────── COMPRESSION & UPLOAD ──────────────
uploadBtn.addEventListener('click', async () => {
    if (!selectedFiles.length) return;
    uploadBtn.style.display = 'none';
    progressWrap.style.display = 'block';

    const options = {
        maxSizeMB: 1.2,           // Keeps size tightly constrained under ~1.2MB for 500+ photo scaling
        maxWidthOrHeight: 1920,   // Clear crispness but web-safe scale
        useWebWorker: true        // Multi-threaded logic to avoid app freezing
    };

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        progressText.textContent = `Optimizing & Uploading ${i + 1} of ${selectedFiles.length}…`;

        try {
            // Compress with the web-worker framework file parameter logic
            const compressedBlob = await imageCompression(file, options);

            // Organized structure format: bucket/college_id/timestamp_filename.jpg
            const safeName = file.name.replace(/\s+/g, '_');
            const path = `${currentCollege}/${Date.now()}_${safeName}`;

            const { error } = await supabaseClient.storage.from(BUCKET).upload(path, compressedBlob, {
                contentType: 'image/jpeg',
                upsert: false,
            });

            if (error) throw error;
        } catch (err) {
            console.error('File sync process failed:', err);
        }

        progressBar.style.width = `${Math.round(((i + 1) / selectedFiles.length) * 100)}%`;
    }

    progressText.textContent = 'Upload complete! 🎉';
    showToast('Photos added successfully!');
    selectedFiles = [];
    fileInput.value = '';
    setTimeout(() => { progressWrap.style.display = 'none'; progressBar.style.width = '0%'; }, 3000);
    loadGallery();
});

// ────────────── GALLERY DISPLAY ──────────────
const track = document.getElementById('sushiTrack');
const slideCounter = document.getElementById('slideCounter');
let carouselOffset = 0;

async function loadGallery() {
    try {
        track.innerHTML = '';
        // Lists items directly out of specific college workspace directory
        const { data: files, error } = await supabaseClient.storage.from(BUCKET).list(currentCollege, {
            limit: 150,
            sortBy: { column: 'created_at', order: 'desc' }
        });

        if (error) throw error;

        const dynamicFiles = (files || []).filter(f => f.name !== '.emptyFolderPlaceholder');
        if (!dynamicFiles.length) {
            document.getElementById('gallerySection').style.display = 'none';
            return;
        }

        for (let i = 0; i < dynamicFiles.length; i++) {
            const fileRef = dynamicFiles[i];
            const { data: urlData } = supabaseClient.storage.from(BUCKET).getPublicUrl(`${currentCollege}/${fileRef.name}`);

            const slide = document.createElement('div');
            slide.className = 'sushi-slide';

            const img = document.createElement('img');
            img.src = urlData.publicUrl;
            img.loading = 'lazy';
            slide.appendChild(img);

            // Simple public delete capability for cleanups
            const delBtn = document.createElement('button');
            delBtn.textContent = '✕';
            delBtn.style.cssText = "position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; cursor:pointer;";
            delBtn.onclick = async () => {
                slide.remove();
                await supabaseClient.storage.from(BUCKET).remove([`${currentCollege}/${fileRef.name}`]);
            };
            slide.appendChild(delBtn);
            track.appendChild(slide);
        }

        document.getElementById('gallerySection').style.display = 'block';
        carouselOffset = 0;
        updateCarousel();

    } catch (err) {
        console.error('Error constructing visual library components:', err);
    }
}

function updateCarousel() {
    track.style.transform = `translateX(-${carouselOffset * 270}px)`;
    slideCounter.textContent = track.children.length ? `${carouselOffset + 1} / ${track.children.length}` : '';
}

document.getElementById('nextBtn').addEventListener('click', () => {
    if (carouselOffset < track.children.length - 1) { carouselOffset++; updateCarousel(); }
});
document.getElementById('prevBtn').addEventListener('click', () => {
    if (carouselOffset > 0) { carouselOffset--; updateCarousel(); }
});

// ────────────── ZIP EXPORT FOR ADVISORS ──────────────
const downloadBtn = document.getElementById('downloadBtn');
const downloadStatus = document.getElementById('downloadStatus');

downloadBtn.addEventListener('click', async () => {
    if (!window.JSZip) {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        document.head.appendChild(s);
        await new Promise(r => s.onload = r);
    }
    downloadBtn.disabled = true;
    downloadStatus.style.display = 'block';
    downloadStatus.textContent = 'Scanning database storage...';

    try {
        const zip = new JSZip();
        const targetColleges = ['elon', 'app_state', 'unc'];

        for (const college of targetColleges) {
            downloadStatus.textContent = `Gathering files for ${college}...`;
            const { data: files } = await supabaseClient.storage.from(BUCKET).list(college, { limit: 300 });

            if (!files) continue;
            const filtered = files.filter(f => f.name !== '.emptyFolderPlaceholder');

            // Create nested directory mapping structures inside our build logic
            const folderInZip = zip.folder(college);

            for (let i = 0; i < filtered.length; i++) {
                downloadStatus.textContent = `Downloading ${college} item (${i + 1}/${filtered.length})`;
                try {
                    const { data: urlData } = supabaseClient.storage.from(BUCKET).getPublicUrl(`${college}/${filtered[i].name}`);
                    const response = await fetch(urlData.publicUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    folderInZip.file(filtered[i].name, arrayBuffer);
                } catch (fileErr) {
                    console.warn("Bypassed download entry:", filtered[i].name, fileErr);
                }
            }
        }

        downloadStatus.textContent = 'Assembling final nested ZIP archive files...';
        const finalZipBlob = await zip.generateAsync({ type: 'blob' });
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(finalZipBlob);
        downloadLink.download = 'SEO_Scholars_Trip_2026_Photos.zip';
        downloadLink.click();

        downloadStatus.textContent = '✓ Download completed successfully!';
    } catch (globalErr) {
        console.error(globalErr);
        downloadStatus.textContent = 'An issue occurred packaging the bundle.';
    }
    downloadBtn.disabled = false;
});

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
}