// =====================================================
// EVENT FACE MATCH - FULL MERGED VERSION
// =====================================================

// ==========================================
// Setup face-api.js
// ==========================================
let faceapiRef = window.faceapi;
let modelsLoaded = false;
let masterMeta = {};

// ==========================================
// Data holders
// ==========================================
let photoEntries = [];
let photoRepresentatives = [];
let allFaceList = [];

// ==========================================
// DOM
// ==========================================
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");
const results = document.getElementById("results");
const uploadBtn = document.getElementById("floatingUploadBtn");
const selfieInput = document.getElementById("selfieFile");
const showAllBtn = document.getElementById("showAllBtn");

const modal = document.getElementById("imageModal");
const modalImg = document.getElementById("modalImage");

const layoutBtn = document.getElementById("layoutToggleBtn");

// ==========================================
// EVENT PARAM
// ==========================================
const params = new URLSearchParams(window.location.search);
const eventName = params.get("event");

if (!eventName) {
  showScreenMessage("Event not specified.");
  throw new Error("Event missing");
}

document.getElementById("eventTitle").innerText =
  `${eventName.replace(/_/g, " ").toUpperCase()}`;

// ==========================================
// FIREBASE URLS
// ==========================================
const BUCKET_BASE =
"https://firebasestorage.googleapis.com/v0/b/phototest-storage.firebasestorage.app/o/";

const MASTER_BIN_URL =
`${BUCKET_BASE}${eventName}%2FMaster_Bin%2Fmaster.bin?alt=media`;

const MASTER_JSON_URL =
`${BUCKET_BASE}${eventName}%2FMaster_Json%2Fmaster.json?alt=media`;

// ==========================================
// HELPERS
// ==========================================
function l2normFloat32(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i];
  s = Math.sqrt(s) || 1e-8;
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] / s;
  return out;
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function decompressDescriptor(int8arr) {
  const out = new Float32Array(128);
  for (let i = 0; i < 128; i++) out[i] = int8arr[i] / 127.0;
  return out;
}

function decompressBox(int16arr) {
  return [int16arr[0], int16arr[1], int16arr[2], int16arr[3]];
}

function parseCompressedBin(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  let offset = 0;
  const faceCount = dv.getUint8(offset++);
  const faces = [];

  for (let f = 0; f < faceCount; f++) {
    const d128 = new Int8Array(128);
    for (let i = 0; i < 128; i++) d128[i] = dv.getInt8(offset++);

    const b4 = new Int16Array(4);
    for (let i = 0; i < 4; i++) {
      b4[i] = dv.getInt16(offset, true);
      offset += 2;
    }

    faces.push({
      descriptor: decompressDescriptor(d128),
      box: decompressBox(b4)
    });
  }
  return faces;
}

// ==========================================
// FACE MODEL LOADER
// ==========================================
async function initFaceModels() {
  if (modelsLoaded) return true;

  const modelURL = "https://justadudewhohacks.github.io/face-api.js/models";

  await faceapiRef.nets.ssdMobilenetv1.loadFromUri(modelURL);
  await faceapiRef.nets.faceLandmark68Net.loadFromUri(modelURL);
  await faceapiRef.nets.faceRecognitionNet.loadFromUri(modelURL);

  modelsLoaded = true;
  return true;
}

// ==========================================
// LOAD MASTER.JSON
// ==========================================
async function loadMasterJson(jsonUrl) {
  const res = await fetch(jsonUrl);
  if (!res.ok) throw new Error("Failed to load master.json");
  masterMeta = await res.json();
}

// ==========================================
// LOAD MASTER.BIN
// ==========================================
async function loadMasterBinFromUrl(binUrl) {
  const res = await fetch(binUrl);
  if (!res.ok) throw new Error("Failed to load master.bin");

  const ab = await res.arrayBuffer();
  const dv = new DataView(ab);

  let offset = 0;
  const totalEntries = dv.getUint32(offset, true);
  offset += 4;

  photoEntries = [];
  photoRepresentatives = [];
  allFaceList = [];

  for (let e = 0; e < totalEntries; e++) {
    const nameLen = dv.getUint8(offset); offset++;
    const name = new TextDecoder().decode(new Uint8Array(ab, offset, nameLen));
    offset += nameLen;

    const binSize = dv.getUint32(offset, true); offset += 4;
    const binSlice = ab.slice(offset, offset + binSize);
    offset += binSize;

    const faces = parseCompressedBin(binSlice);
    photoEntries.push({ name, faces });

    if (!faces.length) {
      photoRepresentatives.push(null);
      continue;
    }

    const sum = new Float32Array(128);

    for (const f of faces) {
      const n = l2normFloat32(f.descriptor);
      for (let k = 0; k < 128; k++) sum[k] += n[k];

      allFaceList.push({
        photoIndex: e,
        descriptor: f.descriptor
      });
    }

    const avg = new Float32Array(128);
    for (let k = 0; k < 128; k++) avg[k] = sum[k] / faces.length;

    photoRepresentatives.push(l2normFloat32(avg));
  }
}

// ==========================================
// EXTRACT SELFIE DESCRIPTOR
// ==========================================
async function extractSelfieDescriptor(file) {
  await initFaceModels();
  const img = await fileToImage(file);

  const result = await faceapiRef
    .detectSingleFace(img, new faceapiRef.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) return null;

  return l2normFloat32(new Float32Array(result.descriptor));
}

// ==========================================
// MATCH SELFIE TO MASTER 
// ==========================================
function matchSelfieToMaster(selfieDesc, threshold = 0.4) {
  if (!selfieDesc) return [];

  const s = l2normFloat32(selfieDesc);
  const matches = [];

  for (let i = 0; i < photoRepresentatives.length; i++) {
    const rep = photoRepresentatives[i];
    if (!rep) continue;

    let d = 0;
    for (let k = 0; k < 128; k++) {
      const diff = s[k] - rep[k];
      d += diff * diff;
    }
    d = Math.sqrt(d);

    if (d <= threshold) matches.push({ photoIndex: i, distance: d });
  }

  return matches;
}

// ==========================================
// SHOW ALL PHOTOS
// ==========================================
function showAllPhotos() {
  results.innerHTML = "";
  for (const filename in masterMeta) {
    const data = masterMeta[filename];
    createPhotoCard(data.downloadURL, data.photoDriveId);
  }
}

showAllBtn.addEventListener("click", showAllPhotos);

// ==========================================
// SHOW MATCHED PHOTOS 
// ==========================================
function showMatches(matches) {
  results.innerHTML = "";

  if (!matches || matches.length === 0) {
    showScreenMessage("No matching photos found.");
    return;
  }

  matches.sort((a, b) => a.distance - b.distance);
  console.log(matches)

  for (const m of matches) {
    const idx = m.photoIndex;
    const name = photoEntries[idx]?.name;
    const meta = masterMeta[name];

    if (meta?.downloadURL) {
      createPhotoCard(meta.downloadURL, meta.photoDriveId);
    }
  }
}

// ==========================================
// DOWNLOAD
// ==========================================
function downloadFromDrive(id) {
  if (!id) {
    showPopup("Download not available.");
    return;
  }
  const link = `https://drive.usercontent.google.com/u/0/uc?id=${id}&export=download`;
  window.open(link, "_blank");
}

// ==========================================
// ==========================================
// CAN CHANGE FROM HERE 
// ==========================================
// ==========================================

// ==========================================
// PROFESSIONAL GALLERY RENDER
// ==========================================
function createPhotoCard(url, driveId) {
  const card = document.createElement("div");
  card.className = "photo-card";

  const img = document.createElement("img");
  img.src = url;
  img.loading = "lazy";
  img.onclick = () => openImageModal(url);

  const downloadBtn = document.createElement("button");
  downloadBtn.className = "download-btn";
  downloadBtn.innerHTML = "Download";
  downloadBtn.onclick = (e) => {
    e.stopPropagation();
    downloadFromDrive(driveId);
  };

  card.appendChild(img);
  card.appendChild(downloadBtn);
  results.appendChild(card);
}


// ==========================================
// IMAGE MODAL
// ==========================================
function openImageModal(url) {
  const modal = document.getElementById("imageModal");
  const img = document.getElementById("modalImage");

  img.src = url;

  modal.style.display = "block";

  // Allow pinch zoom
  img.style.touchAction = "manipulation";
}

document.getElementById("closeModal").onclick = () => {
  document.getElementById("imageModal").style.display = "none";
};

// ==========================================
// UI HELPERS
// ==========================================
function showLoader(text) {
  loader.style.display = "block";
  loaderText.innerText = text;
}

function hideLoader() {
  loader.style.display = "none";
}

function showScreenMessage(message) {
  results.innerHTML = `<div class="empty-state">${message}</div>`;
}

window.showPopup = function(message) {
  document.getElementById("popupMessage").innerText = message;
  document.getElementById("popupOverlay").style.display = "flex";
};

window.closePopup = function() {
  document.getElementById("popupOverlay").style.display = "none";
};



// ==========================================
// UPLOAD HANDLER
// ==========================================
/*uploadBtn.addEventListener("click", () => {
  if (isMobile()) {
    selfieInput.click();     // mobile camera
  } else {
    openDesktopCamera();     // desktop webcam
  }
});*/

uploadBtn.addEventListener("click", () => {
  selfieInput.click();
});

selfieInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    showLoader("Processing Selfie...");

    const descriptor = await extractSelfieDescriptor(file);

    if (!descriptor) {
      hideLoader();
      showPopup("No face detected. Please upload a clear selfie.");
      return;
    }

    const matches = matchSelfieToMaster(descriptor);

    hideLoader();
    showMatches(matches);

  } catch (err) {
    hideLoader();
    showPopup("Face matching failed.");
  } finally {
    selfieInput.value = "";
  }
  
});



// ==========================================
// VERIFY MOBILE
// ==========================================
function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}



// ==========================================
// OPEN DESKTOP CAMERA
// ==========================================
async function openDesktopCamera() {
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    const modal = document.getElementById("imageModal");
    const img = document.getElementById("modalImage");

    modal.style.display = "flex";
    modal.innerHTML = `
    <span class="close-modal" id="closeModal">&times;</span>
      <video id="webcamVideo" autoplay playsinline 
        style="max-width:90%;border-radius:12px;"></video>
      <button id="captureBtn" 
        style="position:absolute;bottom:40px;padding:10px 20px;">
        Capture
      </button>
    `;

    document.getElementById("closeModal").onclick = () => {
      stream.getTracks().forEach(track => track.stop());
      modal.style.display = "none";
    };

    const video = document.getElementById("webcamVideo");
    video.srcObject = stream;

    document.getElementById("captureBtn").onclick = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);

      stream.getTracks().forEach(track => track.stop());

      modal.style.display = "none";

      canvas.toBlob(async (blob) => {
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });

        showLoader("Processing Selfie...");

        const descriptor = await extractSelfieDescriptor(file);

        hideLoader();

        if (!descriptor) {
          showPopup("No face detected.");
          return;
        }

        const matches = matchSelfieToMaster(descriptor);
        showMatches(matches);
      });
    };
  }catch (err) {
    showPopup("Camera access denied or not available.");
  }
}





// ==========================================
// SHOW CAMERA
// ==========================================
/*function showCameraChoice() {
  const popup = document.getElementById("popupOverlay");
  const box = document.querySelector(".popup-box");

  box.innerHTML = `
    <div style="font-size:16px;margin-bottom:20px;">
      Choose Option
    </div>

    <button id="takePhotoBtn" style="width:100%;margin-bottom:10px;">
      📷 Take Selfie
    </button>

    <button id="uploadPhotoBtn" style="width:100%;">
      🖼 Upload From Gallery
    </button>
  `;

  popup.style.display = "flex";

  document.getElementById("takePhotoBtn").onclick = () => {
    popup.style.display = "none";
    selfieInput.click();   // ✅ FIXED
  };

  document.getElementById("uploadPhotoBtn").onclick = () => {
    popup.style.display = "none";
    selfieInput.click();   // same input works
  };
}*/

// ==========================================
// MODAL ZOOM (Desktop Click + Mobile Pinch)
// ==========================================

// Click to zoom (desktop)
modalImg.addEventListener("click", (e) => {
  e.stopPropagation();
  modal.classList.toggle("zoomed");
});

// Click outside image closes modal
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.remove("zoomed");
    modal.style.display = "none";
  }
});


// ==========================================
// LAYOUT CYCLER (1 → 4 → loop)
// ==========================================
let currentCols = 3; // default

results.classList.add("cols-3");

layoutBtn.addEventListener("click", () => {

  // remove old class
  results.classList.remove(
    "cols-1","cols-2","cols-3","cols-4"
  );

  currentCols++;

  if(currentCols > 4){
    currentCols = 1;
  }

  results.classList.add("cols-" + currentCols);

});

// ==========================================
// INITIAL LOAD
// ==========================================
(async () => {
  try {
    showLoader("Loading Event Photos...");
    await loadMasterBinFromUrl(MASTER_BIN_URL);
    await loadMasterJson(MASTER_JSON_URL);
    hideLoader();
    showAllPhotos();
  } catch (err) {
    hideLoader();
    showScreenMessage("Unable to load event photos.");
  }
})();