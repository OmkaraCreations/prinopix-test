/* ===============================
   Floating Particles
================================= */
const container = document.getElementById('particles');

for(let i=0;i<25;i++){
  const particle=document.createElement('div');
  particle.classList.add('particle');
  
  let size=Math.random()*8+4;
  particle.style.width=size+"px";
  particle.style.height=size+"px";
  particle.style.left=Math.random()*100+"%";
  particle.style.animationDuration=(Math.random()*10+10)+"s";
  
  container.appendChild(particle);
}


/* ============================
   DISABLE PAST DATES
============================ */

const eventDateInput = document.getElementById("eventDate");

// Get today's date in YYYY-MM-DD format
const today = new Date().toISOString().split("T")[0];

// Set minimum selectable date to today
eventDateInput.setAttribute("min", today);

/* ============================
   CONTACT FORM
============================ */

document.getElementById("whatsappForm").addEventListener("submit", function(e){
  e.preventDefault();

  let name = document.getElementById("name").value;
  let date = document.getElementById("eventDate").value;
  let service = document.getElementById("service").value;
  if(service === ""){
    alert("Please select a service.");
    return;
  }
  
  let phoneNumber = "919148344585";

  let whatsappMessage =
    `Hello Prinopix,%0A%0A` +
    `Name: ${name}%0A` +
    `Event Date: ${date}%0A` +
    `Service Required: ${service}`;

  window.open(`https://wa.me/${phoneNumber}?text=${whatsappMessage}`,'_blank');
});


/* ============================
   CUSTOM SELECT
============================ */

const customSelect = document.getElementById("serviceSelect");
const trigger = customSelect.querySelector(".select-trigger");
const options = customSelect.querySelectorAll(".select-option");
const hiddenInput = document.getElementById("service");
const selectedText = document.getElementById("selectedService");

trigger.addEventListener("click", () => {
  customSelect.classList.toggle("active");
});

options.forEach(option => {
  option.addEventListener("click", () => {
    const value = option.getAttribute("data-value");
    selectedText.textContent = value;
    hiddenInput.value = value;
    customSelect.classList.remove("active");
  });
});

document.addEventListener("click", (e) => {
  if(!customSelect.contains(e.target)){
    customSelect.classList.remove("active");
  }
});






/* ===============================
   Custom Cursor
================================= */
const dot = document.querySelector(".cursor-dot");
const outline = document.querySelector(".cursor-outline");

let mouseX = 0;
let mouseY = 0;
let outlineX = 0;
let outlineY = 0;

window.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;

  dot.style.left = mouseX + "px";
  dot.style.top = mouseY + "px";
});

function animate() {
  outlineX += (mouseX - outlineX) * 0.85;
  outlineY += (mouseY - outlineY) * 0.85;

  outline.style.left = outlineX + "px";
  outline.style.top = outlineY + "px";

  requestAnimationFrame(animate);
}

animate();


/* ===============================
   Mobile Navbar
================================= */
const hamburger = document.getElementById("hamburger");
const navLinks = document.querySelector(".nav-links");

hamburger.addEventListener("click", () => {
  navLinks.classList.toggle("active");
});


/* ===============================
   Hero Image Slider
================================= */
const heroImages = document.querySelectorAll(".hero-img img");
let currentImage = 0;

function changeImage() {
  heroImages[currentImage].classList.remove("active");
  currentImage = (currentImage + 1) % heroImages.length;
  heroImages[currentImage].classList.add("active");
}

setInterval(changeImage, 6500);




/* ===============================
   RESPONSIVE SMOOTH LOOP CAROUSEL
================================= */

const track = document.querySelector(".carousel-track");
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");

let isAnimating = false;

/* Get dynamic slide width */
function getSlideWidth() {
  const card = document.querySelector(".sample-card");
  const gap = parseInt(window.getComputedStyle(track).gap);
  return card.offsetWidth + gap;
}

/* MOVE NEXT */
nextBtn.addEventListener("click", () => {
  if (isAnimating) return;
  isAnimating = true;

  const slideWidth = getSlideWidth();

  track.style.transition = "transform 0.6s cubic-bezier(.22,.61,.36,1)";
  track.style.transform = `translateX(-${slideWidth}px)`;

  track.addEventListener("transitionend", function handler() {
    track.removeEventListener("transitionend", handler);

    track.appendChild(track.firstElementChild);

    track.style.transition = "none";
    track.style.transform = "translateX(0px)";

    requestAnimationFrame(() => {
      isAnimating = false;
    });
  });
});

/* MOVE PREV */
prevBtn.addEventListener("click", () => {
  if (isAnimating) return;
  isAnimating = true;

  const slideWidth = getSlideWidth();

  track.insertBefore(track.lastElementChild, track.firstElementChild);

  track.style.transition = "none";
  track.style.transform = `translateX(-${slideWidth}px)`;

  requestAnimationFrame(() => {
    track.style.transition = "transform 0.6s cubic-bezier(.22,.61,.36,1)";
    track.style.transform = "translateX(0px)";
  });

  track.addEventListener("transitionend", function handler() {
    track.removeEventListener("transitionend", handler);
    isAnimating = false;
  });
});