import { app } from '../firebase-config.js';
import { initAuthSidebar } from './Auth.js';
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

const CACHE_KEY = 'calamansi_user_profile'; 
console.log("CACHE_KEY:", CACHE_KEY);

class SettingsApp {
    constructor() {
        this.userId = null;
        this.firestoreDocId = null; // Store the actual Firestore document ID
        this.collectionName = "users";
        this.defaultAvatar = "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin";
        
        this.forms = {
            profile: document.getElementById('profileForm'),
            security: document.getElementById('passwordForm')
        };
        
        this.elements = {
            sidebarName: document.getElementById('user-display-name'),
            sidebarEmail: document.getElementById('user-display-email'),
            profileImg: document.querySelector('.w-24.h-24.rounded-full.border-4 img'),
            sidebarImg: document.querySelector('aside img[alt="Admin"]'),
            changePhotoBtn: document.querySelector('.w-24.h-24.rounded-full.border-4'),
            removePhotoBtn: document.querySelector('button.text-xs.text-lime-600'),
            // Custom Modal Elements
            removeModal: document.getElementById('remove-photo-modal'),
            confirmRemoveBtn: document.getElementById('btn-confirm-remove'),
            cancelRemoveBtn: document.getElementById('btn-cancel-remove'),
            // User credentials display elements
            userIdDisplay: document.getElementById('user-id-display'),
            emailVerifiedDisplay: document.getElementById('email-verified-display'),
            emailVerifiedIcon: document.getElementById('email-verified-icon'),
            accountCreatedDisplay: document.getElementById('account-created-display'),
            authProviderDisplay: document.getElementById('auth-provider-display'),
            lastLoginDisplay: document.getElementById('last-login-display'),
            accountStatusDisplay: document.getElementById('account-status-display'),
            accountStatusIcon: document.getElementById('account-status-icon')
        };

        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = 'image/*';

        this.loadFromCache();
        this.init();
    }

    init() {
        console.log('🚀 Initializing Settings App...');
        initAuthSidebar();
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log('User authenticated:', user.email);
                this.userId = user.uid;

                // Display authentication credentials immediately
                this.displayAuthCredentials(user);

                // Then sync with Firestore data
                this.syncUserData();
            } else {
                console.log('User not authenticated, redirecting...');
                localStorage.removeItem(CACHE_KEY);
                window.location.href = '../index.html';
            }
        });
        this.setupEventListeners();
    }

    displayAuthCredentials(user) {
        console.log('Displaying auth credentials for user:', user);

        // User ID
        if (this.elements.userIdDisplay) {
            this.elements.userIdDisplay.value = user.uid;
        }

        // Email and verification status
        if (this.elements.emailVerifiedDisplay) {
            this.elements.emailVerifiedDisplay.value = user.emailVerified ? 'Verified' : 'Not Verified';
        }
        if (this.elements.emailVerifiedIcon) {
            this.elements.emailVerifiedIcon.innerHTML = user.emailVerified
                ? '<i class="fa-solid fa-circle-check text-green-500"></i>'
                : '<i class="fa-solid fa-circle-xmark text-red-500"></i>';
        }

        // Account creation date (metadata)
        if (this.elements.accountCreatedDisplay && user.metadata?.creationTime) {
            const creationDate = new Date(user.metadata.creationTime);
            this.elements.accountCreatedDisplay.value = creationDate.toLocaleString();
        }

        // Authentication provider
        if (this.elements.authProviderDisplay) {
            const provider = user.providerData && user.providerData.length > 0
                ? user.providerData[0].providerId
                : 'Unknown';
            const providerName = provider === 'password' ? 'Email/Password'
                               : provider === 'google.com' ? 'Google'
                               : provider === 'facebook.com' ? 'Facebook'
                               : provider;
            this.elements.authProviderDisplay.value = providerName;
        }

        // Last login time
        if (this.elements.lastLoginDisplay && user.metadata?.lastSignInTime) {
            const lastLoginDate = new Date(user.metadata.lastSignInTime);
            this.elements.lastLoginDisplay.value = lastLoginDate.toLocaleString();
        }

        // Account status
        if (this.elements.accountStatusDisplay) {
            this.elements.accountStatusDisplay.value = 'Active';
        }
        if (this.elements.accountStatusIcon) {
            this.elements.accountStatusIcon.innerHTML = '<i class="fa-solid fa-circle-check text-green-500"></i>';
        }
    }

    // --- LOCAL CACHE ---
    loadFromCache() {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
            const data = JSON.parse(cachedData);
            this.populateUI(data);
        }
    }

    saveToCache(data) {
        const existing = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        const updated = { ...existing, ...data };
        localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    }

    async findUserDocument() {
        try {
            // If document not found at user.uid, try to find it by email or other method
            console.log('Attempting to find user document by alternative methods...');
            
            // You could implement logic here to find the document
            // For now, we'll just log that the document wasn't found
            console.log('User document not found. User ID:', this.userId);
        } catch (error) {
            console.error("Error finding user document:", error);
        }
    }

    // ...existing code...
    populateUI(data) {
        console.log('Populating UI with data:', data);

        // Update sidebar with full name (first name and surname)
        const fullName = `${data.firstName || ''} ${data.surname || ''}`.trim();
        this.syncSidebar(fullName, data.email || '');

        // Update profile image if available
        if (data.photoURL) this.updateAvatarUI(data.photoURL);

        // Populate form fields by ID
        const fields = ['firstName', 'middleName', 'lastName', 'suffix', 'email', 'phone', 'role', 'updatedAt'];
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                if (field === 'createdAt' && data[field]) {
                    // Format the date for display
                    const date = new Date(data[field]);
                    element.value = date.toLocaleString();
                } else {
                    element.value = data[field] || '';
                }
            }
        });

        // Refresh auth credentials display if user is logged in
        if (auth.currentUser) {
            this.displayAuthCredentials(auth.currentUser);
        }

        console.log('UI populated successfully');
    }
// ...existing code...
 

    async syncUserData() {
        try {
            const docRef = doc(db, this.collectionName, this.userId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // Store the actual document ID from Firestore
                this.firestoreDocId = docSnap.id;
                const data = docSnap.data();
                this.saveToCache(data);
                this.populateUI(data);
            } else {
                console.log('No Firestore document found for user:', this.userId);
                // Try to find document by alternative method if needed
                this.findUserDocument();
            }
        } catch (error) {
            console.error("Background sync failed:", error);
        }
    }

    // --- EVENT HANDLERS ---

    async handleProfileUpdate(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        
        const updatedData = {
            
            firstName: document.getElementById('firstName').value,
            middleName: document.getElementById('middleName').value,
            lastName: document.getElementById('lastName').value,
            suffix: document.getElementById('suffix').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            updatedAt: new Date().toISOString()
        };

        this.saveToCache(updatedData);
        this.populateUI(updatedData);
        this.setButtonState(btn, 'Saving...', true);

        try {
            await setDoc(doc(db, this.collectionName, this.userId), updatedData, { merge: true });
            this.setButtonState(btn, 'Saved!', false);
            setTimeout(() => this.setButtonState(btn, 'Save Profile', false), 2000);
        } catch (error) {
            alert("Error: " + error.message);
            this.setButtonState(btn, 'Save Profile', false);
        }
    }

    async handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (!file || !this.userId) return;

        if (this.elements.profileImg) this.elements.profileImg.style.opacity = "0.5";

        try {
            const storageRef = ref(storage, `avatars/${this.userId}`);
            await uploadBytes(storageRef, file);
            const photoURL = await getDownloadURL(storageRef);
            
            this.saveToCache({ photoURL });
            this.updateAvatarUI(photoURL);
            await setDoc(doc(db, this.collectionName, this.userId), { photoURL }, { merge: true });
        } catch (error) {
            alert("Upload failed: " + error.message);
        } finally {
            if (this.elements.profileImg) this.elements.profileImg.style.opacity = "1";
        }
    }

    // Custom Modal Logic for Photo Removal
    handlePhotoRemove() {
        if (this.elements.removeModal) {
            this.elements.removeModal.classList.remove('hidden');
        }
    }

    async executePhotoRemoval() {
        const btn = this.elements.confirmRemoveBtn;
        this.setButtonState(btn, 'Removing...', true);

        try {
            // Update Firestore
            await setDoc(doc(db, this.collectionName, this.userId), { 
                photoURL: this.defaultAvatar 
            }, { merge: true });

            // Update Cache and UI
            this.saveToCache({ photoURL: this.defaultAvatar });
            this.updateAvatarUI(this.defaultAvatar);

            // Cleanup storage
            const storageRef = ref(storage, `avatars/${this.userId}`);
            await deleteObject(storageRef).catch(() => console.log("Storage file already empty."));

            this.elements.removeModal.classList.add('hidden');
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            this.setButtonState(btn, 'Remove', false);
        }
    }

    async handlePasswordUpdate(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const [currentPwdInput, newPwdInput, confirmPwdInput] = e.target.querySelectorAll('input');

        if (newPwdInput.value !== confirmPwdInput.value) {
            alert("New passwords do not match!");
            return;
        }

        this.setButtonState(btn, 'Updating...', true);

        try {
            const user = auth.currentUser;
            const credential = EmailAuthProvider.credential(user.email, currentPwdInput.value);
            
            // Re-authentication
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPwdInput.value);

            alert("Password updated successfully!");
            e.target.reset();
        } catch (error) {
            alert("Security Error: " + error.message);
        } finally {
            this.setButtonState(btn, 'Update Password', false);
        }
    }
    
    updateAvatarUI(url) {
        if (this.elements.profileImg) this.elements.profileImg.src = url;
        if (this.elements.sidebarImg) this.elements.sidebarImg.src = url;
    }

    syncSidebar(fullName, email) {
        if (this.elements.sidebarName) this.elements.sidebarName.innerText = fullName || "User";
        if (this.elements.sidebarEmail) this.elements.sidebarEmail.innerText = email || "";
    }

    setButtonState(btn, text, isLoading) {
        if (!btn) return;
        btn.innerText = text;
        btn.disabled = isLoading;
        btn.style.opacity = isLoading ? '0.5' : '1';
    }

    setupEventListeners() {
        if (this.forms.profile) this.forms.profile.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        
        this.elements.changePhotoBtn?.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
        
        // Modal Trigger
        this.elements.removePhotoBtn?.addEventListener('click', () => this.handlePhotoRemove());
        
        // Modal Actions
        this.elements.cancelRemoveBtn?.addEventListener('click', () => this.elements.removeModal.classList.add('hidden'));
        this.elements.confirmRemoveBtn?.addEventListener('click', () => this.executePhotoRemoval());

        if (this.forms.security) this.forms.security.addEventListener('submit', (e) => this.handlePasswordUpdate(e));
    }
}

document.addEventListener('DOMContentLoaded', () => new SettingsApp());