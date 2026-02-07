import { app } from '../firebase-config.js';
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    // --- PART 1: DISPLAY USER INFO ---
    const nameDisplay = document.getElementById('user-display-name');
    const emailDisplay = document.getElementById('user-display-email');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            if (emailDisplay) emailDisplay.innerText = user.email;
            
            // If they have a Display Name set in Firebase, use it. Otherwise, use "Farm Admin"
            if (nameDisplay && user.displayName) {
                nameDisplay.innerText = user.displayName;
            }
        } else {
            // No user is signed in (Redirect to login)
            window.location.href = "../index.html";
        }
    });

    // --- PART 2: LOGOUT MODAL LOGIC ---
    const triggerBtn = document.getElementById('btn-logout-trigger');
    const modal = document.getElementById('logout-modal');
    const backdrop = document.getElementById('logout-backdrop');
    const panel = document.getElementById('logout-panel');
    const cancelBtn = document.getElementById('btn-cancel-logout');
    const confirmBtn = document.getElementById('btn-confirm-logout');

    const openModal = () => {
        if (!modal) return;
        modal.classList.remove('hidden');
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            panel.classList.remove('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
            panel.classList.add('opacity-100', 'translate-y-0', 'sm:scale-100');
        }, 10);
    };

    const closeModal = () => {
        if (!modal) return;
        backdrop.classList.add('opacity-0');
        panel.classList.remove('opacity-100', 'translate-y-0', 'sm:scale-100');
        panel.classList.add('opacity-0', 'translate-y-4', 'sm:translate-y-0', 'sm:scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    };

    if (triggerBtn) triggerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
    });

    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (modal) modal.addEventListener('click', (e) => {
        if (e.target.closest('#logout-panel') === null) closeModal();
    });

    if (confirmBtn) confirmBtn.addEventListener('click', async () => {
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Signing out...`;
        confirmBtn.disabled = true;
        try {
            await signOut(auth);
            window.location.href = "../index.html";
        } catch (error) {
            console.error("Error signing out:", error);
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
            closeModal();
        }
    });
});