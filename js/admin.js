/* ===============================
   Import 
================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getDatabase, ref, onValue, update,remove,off,get,set} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getStorage, ref as sRef, listAll, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";


/* ===============================
   Firebase Init
================================= */
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


/* ===============================
   Authenticaion Protection
================================= */
onAuthStateChanged(auth, user=>{
  if(!user) window.location.href="auth.html";
});


/* ===============================
   Global State
================================= */
let currentLogsRef = null;
let allLogs = [];
let allEvents = [];


/* ===============================
   DOM References
================================= */
const adminLoader = document.getElementById("adminLoader");
const storageContainer = document.getElementById("storageEventsContainer");

const eventList = document.getElementById("eventList");
const logTableBody = document.getElementById("logTableBody");
const logSearch = document.getElementById("logSearch");
const logTypeFilter = document.getElementById("logTypeFilter");
const logSourceFilter = document.getElementById("logSourceFilter");

const sidebar = document.querySelector(".admin-sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebarMenu = document.querySelector(".sidebar-menu");
const logoutBtn = document.getElementById("logoutBtn");
const logoImg = document.querySelector(".sidebar-logo");

const modal = document.getElementById("customModal");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalInputWrapper = document.getElementById("modalInputWrapper");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");



/* ===============================
   Loader Animation
================================= */
function showLoader(){adminLoader?.classList.remove("hidden");}
function hideLoader(){adminLoader?.classList.add("hidden");}



/* ===============================
   Firebase : Load Storage Events
================================= */
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
        window.open("event.html?event="+folder.name,"_blank");
      };
      storageContainer.appendChild(card);
    });

  }catch(err){
    console.error("Storage load error:", err);
  }
}
loadStorageEvents();



/* ===============================
   Firebase : Create Log Events
================================= */
document.getElementById("addLogEventBtn").addEventListener("click", async ()=>{
  const eventName = await openModal({
    title: "Enter Event Name"
  });

  if(!eventName) return;

  try{
    const dummyFile = new Blob(["init"]);

    //await uploadBytes(sRef(storage, `${eventName}/Master_Bin/master.bin`), dummyFile);
    //await uploadBytes(sRef(storage, `${eventName}/Master_Json/master.json`), dummyFile);
    //await uploadBytes(sRef(storage, `${eventName}/Photo_Thumbnail/init.txt`), dummyFile);
    
    let nowTime = new Date().toISOString()         // Starts as: "2025-12-28T14:48:09.453Z"
        
    const nowTimeEdited = nowTime
      .replace("T", "_")     // Becomes: "2025-12-28_14:48:09.453Z"
      .replace(/:/g, "-")    // Becomes: "2025-12-28_14-48-09.453Z"
      .replace(".", "-")     // Becomes: "2025-12-28_14-48-09-453Z"
      .slice(0, -1); 

    await update(ref(db,"logs/"+eventName), {
       [nowTimeEdited]: [nowTime]+"|Website|INFO|Initialization|Created New Event"
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


/* ===============================
   Firebase : Create Storage Events
================================= */
document.getElementById("addStorageEventBtn").addEventListener("click", async ()=>{
  const eventName = await openModal({
    title: "Enter Event Name"
  });

  if(!eventName) return;

  try{
    const dummyFile = new Blob(["init"]);

    await uploadBytes(sRef(storage, `${eventName}/Master_Bin/master.bin`), dummyFile);
    await uploadBytes(sRef(storage, `${eventName}/Master_Json/master.json`), dummyFile);
    await uploadBytes(sRef(storage, `${eventName}/Photo_Thumbnail/init.txt`), dummyFile);

    await openModal({
      title: "Event Created Successfully",
      showInput:false
    });
    loadStorageEvents();

  }catch(err){
    console.error("Create event error:", err);
  }
});



/* ===============================
   Logout
================================= */
document.getElementById("logoutBtn").addEventListener("click",()=>{
  signOut(auth).then(()=>window.location.href="auth.html");
});



/* ===============================
   Log Events
================================= */
showLoader();
onValue(ref(db, "logs"), snapshot=>{
  allEvents = [];
  snapshot.forEach(child=>{
    allEvents.push(child.key);
  });
  renderEventList();
  hideLoader();
});


/* ===============================
   Render Event List Function
================================= */
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
      div.onclick = ()=>{
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


/* ===============================
   Firebase : Load Logs
================================= */
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


/* ===============================
   Render Logs
================================= */
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
  const sourceOptionsContainer = document.getElementById("logSourceOptions");
  const selectedSourceText = document.getElementById("selectedLogSource");
  const logSourceHidden = document.getElementById("logSourceFilter");

  if (sourceOptionsContainer) {
    const currentSelected = logSourceHidden.value; // preserve selection
  
    const uniqueSources = [...new Set(parsedLogs.map(l => l.source))];

    sourceOptionsContainer.innerHTML = `
      <div class="select-option" data-value="">All Sources</div>
    `;

    uniqueSources.forEach(src => {
      const div = document.createElement("div");
      div.className = "select-option";

      div.setAttribute("data-value", src);
      div.textContent = src;

      sourceOptionsContainer.appendChild(div);
    });

    //working till here
    
    // Rebind click events
    sourceOptionsContainer.querySelectorAll(".select-option").forEach(option => {
    
      option.addEventListener("click", () => {
        const value = option.getAttribute("data-value");
        selectedSourceText.textContent = option.textContent;
        logSourceHidden.value = value;
        document.getElementById("logSourceSelect").classList.remove("active");
        renderLogs();
      });
    });

    // Restore selected label after rebuild
    const selectedOption = sourceOptionsContainer.querySelector(
      `.select-option[data-value="${currentSelected}"]`
    );

    if (selectedOption) {
      selectedSourceText.textContent = selectedOption.textContent;
    } else {
      selectedSourceText.textContent = "All Sources";
    }
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
      ? log.source.toLowerCase() === sourceVal.toLowerCase()
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
        <td class="expandable">${log.timestamp ? new Date(log.timestamp).toLocaleString() : "-"}</td>
        <td class="expandable">${log.source}</td>
        <td class="expandable">${log.logType}</td>
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

  enableColumnResize();
}


/* ===============================
   Search Logs
================================= */
logSearch?.addEventListener("input", renderLogs);
//logTypeFilter?.addEventListener("change", renderLogs);
//logSourceFilter?.addEventListener("change", renderLogs);



/* ===============================
   Event Name Menue + Firebase
================================= */
function showEventMenu(e, eventName){

  e.stopPropagation(); // prevent immediate outside click closing

  // 🔥 Remove existing dropdown if present
  const existingMenu = document.querySelector(".event-dropdown");
  if (existingMenu) {
    existingMenu.remove();

    // If clicking same trigger again, just close it (toggle)
    if (existingMenu.dataset.event === eventName) {
      return;
    }
  }
  
  const menu = document.createElement("div");
  menu.className="event-dropdown";
  menu.innerHTML=`
    <div class="dropdown-item" id="renameEvent">Rename</div>
    <div class="dropdown-item" id="deleteEvent">Delete</div>
  `;

  document.body.appendChild(menu);

  menu.style.position="absolute";
  menu.style.top=e.pageY+"px";
  menu.style.left=e.pageX-88+"px";
  menu.style.background="#111";
  menu.style.padding="8px";
  menu.style.borderRadius="8px";
  menu.style.zIndex="9999";
  menu.style.cursor="pointer";
  menu.style.fontSize="18px";

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


/* ===============================
   Download Event Logs
================================= */
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


/* ===============================
   Side Bar Function
================================= */
document.querySelectorAll(".sidebar-item").forEach(item=>{
  item.addEventListener("click",()=>{
    document.querySelectorAll(".sidebar-item").forEach(i=>i.classList.remove("active"));
    document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));

    item.classList.add("active");
    document.getElementById(item.dataset.section+"Section").classList.add("active");
  });
});
//Side Bar Responsive
function handleSidebarToggle(){

  if(window.innerWidth > 992){
    // DESKTOP COLLAPSE
    sidebar.classList.toggle("collapsed");

    // Hide logout when collapsed
    logoutBtn.style.display = sidebar.classList.contains("collapsed") ? "none" : "block";

    // Change logo to favicon when collapsed
    if(sidebar.classList.contains("collapsed")){
      logoImg.style.opacity = 0;
        // favicon image
    }else{
      logoImg.style.display = "block"; 
      logoImg.style.opacity = 1;    // full logo
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


/* ===============================
   Confirmation Input Form
================================= */
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


/* ===============================
   Custom Dropdown Function
================================= */
function initCustomSelect(selectId, selectedTextId, optionsContainerId, hiddenInputId){
  const customSelect = document.getElementById(selectId);
  const trigger = customSelect.querySelector(".select-trigger");
  const options = customSelect.querySelectorAll(".select-option");
  const hiddenInput = document.getElementById(hiddenInputId);
  const selectedText = document.getElementById(selectedTextId);

  trigger.addEventListener("click", () => {
    customSelect.classList.toggle("active");
  });

  options.forEach(option => {
    option.addEventListener("click", () => {
      const value = option.getAttribute("data-value");
      selectedText.textContent = option.textContent;
      hiddenInput.value = value;
      customSelect.classList.remove("active");
      renderLogs();
    });
  });

  document.addEventListener("click", (e) => {
    if(!customSelect.contains(e.target)){
      customSelect.classList.remove("active");
    }
  });
}
initCustomSelect("logTypeSelect","selectedLogType",null,"logTypeFilter");
initCustomSelect("logSourceSelect","selectedLogSource",null,"logSourceFilter");


/* ===============================
   Column Resize Function
================================= */
function enableColumnResize() {
  const table = document.querySelector(".log-table");
  if (!table) return;

  const headers = table.querySelectorAll("th");

  headers.forEach((th) => {

    if (th.querySelector(".resizer")) return;

    const resizer = document.createElement("div");
    resizer.className = "resizer";
    th.appendChild(resizer);

    let startX = 0;
    let startWidth = 0;

    // DESKTOP
    resizer.addEventListener("mousedown", (e) => {
      startX = e.pageX;
      startWidth = th.offsetWidth;

      document.addEventListener("mousemove", resize);
      document.addEventListener("mouseup", stop);
    });

    // MOBILE
    resizer.addEventListener("touchstart", (e) => {
      startX = e.touches[0].pageX;
      startWidth = th.offsetWidth;

      document.addEventListener("touchmove", resizeTouch);
      document.addEventListener("touchend", stopTouch);
    });

    function resize(e) {
      const newWidth = startWidth + (e.pageX - startX);
      if (newWidth > 15) {
        th.style.width = newWidth + "px";
      }
    }

    function resizeTouch(e) {
      const newWidth = startWidth + (e.touches[0].pageX - startX);
      if (newWidth > 15) {
        th.style.width = newWidth + "px";
      }
    }

    function stop() {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stop);
    }

    function stopTouch() {
      document.removeEventListener("touchmove", resizeTouch);
      document.removeEventListener("touchend", stopTouch);
    }

  });
}