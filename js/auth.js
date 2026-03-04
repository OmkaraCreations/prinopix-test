// =============================
// Firebase Config
// =============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyA5twEWVexhSUFqDctpLonpsj8HfN69WDs",
  authDomain: "phototest-storage.firebaseapp.com",
  databaseURL: "https://phototest-storage-default-rtdb.firebaseio.com",
  projectId: "phototest-storage",
  storageBucket: "phototest-storage.firebasestorage.app",
  messagingSenderId: "774310548934",
  appId: "1:774310548934:web:ea1426c111f33c1fe38ec7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// =============================
// Set Session Persistence
// =============================
// This ensures login is removed once tab/browser closes

setPersistence(auth, browserSessionPersistence)
  .then(() => {
    console.log("Session persistence enabled.");
  });

// =============================
// Login Form
// =============================

const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "admin.html";
  } catch (error) {
    errorMsg.textContent = "Failed to Login. Username or Password Incorrect";
    console.log(error.message);
  }
});

// =============================
// Redirect if already logged in
// =============================

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "admin.html";
  }
});