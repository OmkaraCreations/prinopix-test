import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { 
  getDatabase, 
  ref, 
  onValue, 
  push,
  remove,
  off,
  get,
  set
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { 
  getStorage, 
  ref as sRef, 
  listAll, 
  uploadBytes 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";


/* ================= FIREBASE INIT ================= */

const firebaseConfig = { 
  apiKey: "AIzaSyA5twEWVexhSUFqDctpLonpsj8HfN69WDs",
  authDomain: "phototest-storage.firebaseapp.com",
  databaseURL: "https://phototest-storage-default-rtdb.firebaseio.com",
  projectId: "phototest-storage",
  storageBucket: "phototest-storage.firebasestorage.app",
  messagingSenderId: "774310548934",
  appId: "1:774310548934:web:ea1426c111f33c1fe38ec7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);
const eventSearch = document.getElementById("eventSearch");

/* ================= AUTH PROTECT ================= */

onAuthStateChanged(auth, user=>{
  if(!user) window.location.href="auth.html";
});




const adminLoader = document.getElementById("adminLoader");

function showLoader(){
  adminLoader?.classList.remove("hidden");
}

function hideLoader(){
  adminLoader?.classList.add("hidden");
}





/* ================= SIDEBAR SWITCH ================= */

document.querySelectorAll(".sidebar-item").forEach(item=>{
  item.addEventListener("click",()=>{
    document.querySelectorAll(".sidebar-item").forEach(i=>i.classList.remove("active"));
    document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));

    item.classList.add("active");
    document.getElementById(item.dataset.section+"Section").classList.add("active");
  });
});


/* ================= STORAGE EVENTS ================= */

const storageContainer = document.getElementById("storageEventsContainer");

async function loadStorageEvents(){
  try{
    const rootRef = sRef(storage);
    const result = await listAll(rootRef);

    storageContainer.innerHTML="";

    result.prefixes.forEach(folder=>{
      const card = document.createElement("div");
      card.className="admin-card";
      card.innerHTML=`<h3>${folder.name}</h3>`;
      card.onclick=()=>{
        window.open("eventphotos.html?event="+folder.name,"_blank");
      };
      storageContainer.appendChild(card);
    });

  }catch(err){
    console.error("Storage load error:", err);
  }
}

loadStorageEvents();


/* ================= CREATE EVENT ================= */

document.getElementById("addEventBtn").addEventListener("click", async ()=>{
  const eventName = await openModal({
    title: "Enter Event Name"
  });

  if(!eventName) return;

  try{
    const dummyFile = new Blob(["init"]);

    await uploadBytes(sRef(storage, `${eventName}/Master_Bin/master.bin`), dummyFile);
    await uploadBytes(sRef(storage, `${eventName}/Master_Json/master.json`), dummyFile);
    await uploadBytes(sRef(storage, `${eventName}/Photo_Thumbnail/init.txt`), dummyFile);

    await push(ref(db,"logs/"+eventName), {
      message: "Event Created",
      logType: "info",
      source: "system",
      correlationId: "init",
      timestamp: Date.now()
    });

    await openModal({
      title: "Event Created Successfully",
      showInput:false
    });
    loadStorageEvents();

  }catch(err){
    console.error("Create event error:", err);
  }
});


/* ================= LOGOUT ================= */

document.getElementById("logoutBtn").addEventListener("click",()=>{
  signOut(auth).then(()=>window.location.href="auth.html");
});


/* ================= LOG EVENTS ================= */

const eventList = document.getElementById("eventList");
const logTableBody = document.getElementById("logTableBody");
const logSearch = document.getElementById("logSearch");
const logTypeFilter = document.getElementById("logTypeFilter");
const logSourceFilter = document.getElementById("logSourceFilter");

let currentLogsRef = null;
let allLogs = [];
let allEvents = [];


/* -------- LOAD EVENT NAMES REALTIME -------- */
showLoader();
onValue(ref(db, "logs"), snapshot=>{
  
  allEvents = [];

  snapshot.forEach(child=>{
    allEvents.push(child.key);
  });

  renderEventList();
  hideLoader();
});

function renderEventList(){

  if(!eventList) return;

  const searchVal = eventSearch.value.toLowerCase();

  eventList.innerHTML = "";

  allEvents
    .filter(eventName =>
      eventName.toLowerCase().includes(searchVal)
    )
    .sort()
    .forEach(eventName => {

      const div = document.createElement("div");
      div.className="event-item";

      div.innerHTML = `
        <span class="event-name">${eventName}</span>
        <i class="fa-solid fa-ellipsis-vertical event-menu"></i>
      `;

      /* CLICK EVENT NAME */
      div.querySelector(".event-name").onclick = ()=>{
        document.querySelectorAll(".event-item")
          .forEach(e=>e.classList.remove("active"));

        div.classList.add("active");
        loadLogs(eventName);
      };

      /* 3 DOT MENU */
      div.querySelector(".event-menu").onclick = (e)=>{
        e.stopPropagation();
        showEventMenu(e, eventName);
      };

      eventList.appendChild(div);

    });
}

eventSearch?.addEventListener("input", renderEventList);

/* -------- LOAD LOGS REALTIME -------- */

function loadLogs(eventName){

  showLoader();

  if(currentLogsRef){
    off(currentLogsRef);
  }

  currentLogsRef = ref(db, "logs/"+eventName);
  onValue(currentLogsRef, snap=>{
    allLogs=[];

    snap.forEach(child=>{
      allLogs.push({
        key: child.key,
        raw: child.val()
      });
    });
    renderLogs();
    hideLoader();
  });
}


/* -------- RENDER TABLE -------- */

function renderLogs(){

  if(!logTableBody) return;

  const searchVal = logSearch.value.toLowerCase();
  const typeVal = logTypeFilter.value;
  const sourceVal = logSourceFilter?.value || "";

  logTableBody.innerHTML = "";

  /* Parse logs */
  const parsedLogs = allLogs.map(log => {

    const parts = log.raw.split("|").map(p => p.trim());

    return {
      timestamp: parts[0] || "",
      source: parts[1] || "",
      logType: parts[2] || "",
      correlationId: parts[3] || "",
      message: parts[4] || "",
      raw: log.raw
    };
  });

  /* -------- DYNAMIC SOURCE FILTER -------- */
  if(logSourceFilter){

    const uniqueSources = [...new Set(parsedLogs.map(l => l.source))];

    const currentSelected = logSourceFilter.value;

    logSourceFilter.innerHTML = `<option value="">All Sources</option>`;

    uniqueSources.forEach(src=>{
      const option = document.createElement("option");
      option.value = src;
      option.textContent = src;
      logSourceFilter.appendChild(option);
    });

    logSourceFilter.value = currentSelected;
  }

  /* -------- FILTER -------- */
  parsedLogs
    .filter(log => {

      const message = log.message.toLowerCase();
      const source = log.source.toLowerCase();
      const correlationId = log.correlationId.toLowerCase();

      const matchesType = typeVal
        ? log.logType.toLowerCase() === typeVal.toLowerCase()
        : true;

      const matchesSource = sourceVal
        ? log.source === sourceVal
        : true;

      const matchesSearch =
        message.includes(searchVal) ||
        source.includes(searchVal) ||
        correlationId.includes(searchVal);

      return matchesType && matchesSource && matchesSearch;
    })
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
    .forEach(log => {

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}</td>
        <td>${log.source}</td>
        <td>${log.logType}</td>
        <td class="expandable">${log.correlationId}</td>
        <td class="expandable">${log.message}</td>
      `;

      logTableBody.appendChild(tr);

      /* Expand only correlation + message */
      tr.querySelectorAll(".expandable").forEach(td=>{
        td.addEventListener("click",()=>{
          td.classList.toggle("expanded");
        });
      });
    });
}



logSearch?.addEventListener("input", renderLogs);
logTypeFilter?.addEventListener("change", renderLogs);
logSourceFilter?.addEventListener("change", renderLogs);


/* ================= 3 DOT MENU ================= */

function showEventMenu(e, eventName){

  const menu = document.createElement("div");
  menu.className="event-dropdown";
  menu.innerHTML=`
    <div class="dropdown-item" id="renameEvent">Rename</div>
    <div class="dropdown-item" id="deleteEvent">Delete</div>
  `;

  document.body.appendChild(menu);

  menu.style.position="absolute";
  menu.style.top=e.pageY+"px";
  menu.style.left=e.pageX+"px";
  menu.style.background="#111";
  menu.style.padding="8px";
  menu.style.borderRadius="8px";
  menu.style.zIndex="9999";
  menu.style.cursor="pointer";

  /* RENAME */
  menu.querySelector("#renameEvent").onclick = async ()=>{
    const newName = await openModal({
      title: "Rename Event",
      defaultValue: eventName
    });

    if(!newName || newName===eventName) return;
 

    const oldRef = ref(db,"logs/"+eventName);
    const newRef = ref(db,"logs/"+newName);

    const snapshot = await get(oldRef);

    if(snapshot.exists()){
      await set(newRef, snapshot.val());
      await remove(oldRef);
    }

    menu.remove();
  };

  /* DELETE */
  menu.querySelector("#deleteEvent").onclick = async ()=>{
    const confirmDelete = await openModal({
      title: "Delete this event?",
      showInput:false
    });

    if(confirmDelete){
      await remove(ref(db,"logs/"+eventName));
    }
    menu.remove();
  };

  /* CLOSE ON OUTSIDE CLICK */
  document.addEventListener("click", ()=>{
    menu.remove();
  }, { once:true });
}


document.getElementById("downloadLogsBtn")?.addEventListener("click", () => {

  if(!allLogs.length) return alert("No logs to download");

  const rows = [];

  rows.push(["Timestamp","Source","LogType","CorrelationId","Message"]);

  allLogs.forEach(log => {

    const parts = log.raw.split("|").map(p => p.trim());

    rows.push([
      parts[0] || "",
      parts[1] || "",
      parts[2] || "",
      parts[3] || "",
      parts[4] || ""
    ]);

  });

  const csvContent = rows.map(e => e.map(v => `"${v}"`).join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "logs.csv";
  a.click();

  URL.revokeObjectURL(url);
});





/* ================= RESPONSIVE SIDEBAR ================= */

const sidebar = document.querySelector(".admin-sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarMenu = document.querySelector(".sidebar-menu");
const logoutBtn = document.getElementById("logoutBtn");
const logoImg = document.querySelector(".sidebar-logo");

function handleSidebarToggle(){

  if(window.innerWidth > 992){
    // DESKTOP COLLAPSE
    sidebar.classList.toggle("collapsed");

    // Hide logout when collapsed
    logoutBtn.style.display = sidebar.classList.contains("collapsed") ? "none" : "block";

    // Change logo to favicon when collapsed
    if(sidebar.classList.contains("collapsed")){
      logoImg.src = "../img/Asset 1.png";   // favicon image
    }else{
      logoImg.src = "../img/Logo.png";      // full logo
    }

  } else {
    // MOBILE DROPDOWN
    sidebarMenu.classList.toggle("active");
  }
}

sidebarToggle?.addEventListener("click", handleSidebarToggle);


/* Close mobile menu when clicking item */
document.querySelectorAll(".sidebar-item").forEach(item=>{
  item.addEventListener("click",()=>{
    if(window.innerWidth <= 992){
      sidebarMenu.classList.remove("active");
    }
  });
});


/* Reset on resize */
window.addEventListener("resize",()=>{
  if(window.innerWidth > 992){
    sidebarMenu.classList.remove("active");
    logoutBtn.style.display = "block";
    logoImg.src = "../img/Logo.png";
  }
});


/* ================= CUSTOM MODAL SYSTEM ================= */

const modal = document.getElementById("customModal");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalInputWrapper = document.getElementById("modalInputWrapper");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");

function openModal({ title, defaultValue="", showInput=true }){

  return new Promise((resolve)=>{

    modalTitle.textContent = title;
    modalInput.value = defaultValue;

    modalInputWrapper.style.display = showInput ? "block" : "none";

    modal.classList.remove("hidden");

    modalConfirm.onclick = ()=>{
      modal.classList.add("hidden");
      resolve(showInput ? modalInput.value.trim() : true);
    };

    modalCancel.onclick = ()=>{
      modal.classList.add("hidden");
      resolve(null);
    };

  });

}
