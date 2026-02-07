import { app } from '../firebase-config.js';
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

export function initAuthSidebar() {
    const sidebarName = document.getElementById('user-display-name');
    const sidebarEmail = document.getElementById('user-display-email');
    const sidebarImg = document.getElementById('sidebar-avatar');

    // Sidebar Toggle Logic
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeBtn = document.getElementById('sidebar-close');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.remove('-translate-x-full');
            if (backdrop) backdrop.classList.remove('hidden');
        });
    }

    if (closeBtn && sidebar) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            if (backdrop) backdrop.classList.add('hidden');
        });
    }

    if (backdrop && sidebar) {
        backdrop.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
            backdrop.classList.add('hidden');
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // 1. Initial Load from Cache (Immediate UI update)
            const cached = JSON.parse(localStorage.getItem('calamansi_user_profile') || '{}');
            const cachedName = cached.firstName ? `${cached.firstName} ${cached.lastName || cached.surname || ''}`.trim() : null;
            
            if (sidebarName) sidebarName.innerText = cachedName || user.displayName || "Admin";
            if (sidebarEmail) sidebarEmail.innerText = user.email;
            
            if (sidebarImg) {
                if (cached.photoURL) {
                    sidebarImg.src = cached.photoURL;
                } else if (user.photoURL) {
                    sidebarImg.src = user.photoURL;
                } else {
                    sidebarImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${cached.surname || cached.lastName || 'Admin'}`;
                }
            }

            // 2. Real-time sync with Firestore (Ensure latest data)
            const userDocRef = doc(db, "users", user.uid);
            onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    const fullName = `${userData.firstName} ${userData.surname || userData.lastName || ''}`.trim();
                    
                    // Update UI
                    if (sidebarName) sidebarName.innerText = fullName || "Admin";
                    if (sidebarEmail) sidebarEmail.innerText = userData.email || user.email;
                    
                    if (sidebarImg) {
                        if (userData.photoURL) {
                            sidebarImg.src = userData.photoURL;
                        } else {
                            sidebarImg.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.surname || userData.lastName || 'Admin'}`;
                        }
                    }

                    // Update Cache
                    localStorage.setItem('calamansi_user_profile', JSON.stringify(userData));
                }
            });
        } else {
            // Not authenticated
            window.location.href = '../index.html';
        }
    });
}