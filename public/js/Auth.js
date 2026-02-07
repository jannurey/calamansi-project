import { app } from '../firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const auth = getAuth(app);

export function initAuthSidebar() {
    const sidebarName = document.getElementById('user-display-name');
    const sidebarEmail = document.getElementById('user-display-email');
    const sidebarImg = document.getElementById('sidebar-avatar');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Load from cache or Firebase
            const cached = JSON.parse(localStorage.getItem('calamansi_user_profile') || '{}');
            const fullName = cached.firstName ? `${cached.firstName} ${cached.lastName || ''}`.trim() : (user.displayName || "Admin");
            
            if (sidebarName) sidebarName.innerText = fullName;
            if (sidebarEmail) sidebarEmail.innerText = user.email;
            
            // Set photo
            if (user.photoURL && sidebarImg) {
                sidebarImg.src = user.photoURL;
            } else if (cached.photoURL && sidebarImg) {
                sidebarImg.src = cached.photoURL;
            }
        } else {
            // Not authenticated - redirect or show message
            alert("Your session has expired. Please log in again.");
            window.location.href = '../index.html';
        }
    });
}