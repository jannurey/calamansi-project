// public/login.js

import { app } from '../firebase-config.js';
import { 
    getAuth, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

class AuthManager {
    constructor() {
        // UI Elements
        this.form = document.getElementById('loginForm');
        this.submitBtn = document.getElementById('submitBtn');
        this.passwordInput = document.getElementById('password');
        this.eyeIcon = document.getElementById('eyeIcon');
        
        // Error Box Elements
        this.errorContainer = document.getElementById('errorContainer');
        this.errorText = document.getElementById('errorText');
        
        this.isSubmitting = false;
        this.initListeners();
    }

    initListeners() {
        if(this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        
        // Hide error message as soon as user starts typing to try again
        const inputs = this.form.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.hideError());
        });
    }

    togglePasswordVisibility() {
        const type = this.passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        this.passwordInput.setAttribute('type', type);
        
        // Toggle Icon
        if (type === 'text') {
            this.eyeIcon.classList.remove('fa-eye');
            this.eyeIcon.classList.add('fa-eye-slash');
        } else {
            this.eyeIcon.classList.remove('fa-eye-slash');
            this.eyeIcon.classList.add('fa-eye');
        }
    }

        async handleSubmit(e) {
            e.preventDefault();
            
            if (this.isSubmitting) return;

            this.hideError();
            this.setLoading(true);

            try {
                const email = document.getElementById('email').value;
                const password = this.passwordInput.value;

                console.log("Authenticating user:", email);
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                console.log("User authenticated:", user.uid);

                // Get Firestore document
                const userDocRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userDocRef);

                if (!userSnap.exists()) {
                    throw new Error("No user profile found. Contact admin.");
                }

                const userData = userSnap.data();
                console.log("User Firestore data:", userData);

                // Check status
                if (userData.status?.toLowerCase() === 'inactive') {
                    throw new Error("Account is inactive. Please contact admin.");
                }

                // ✅ Check admin or user role
                const userRole = userData.role?.toLowerCase();
                if (!userRole || (userRole !== 'admin' && userRole !== 'user')) {
                    throw new Error("Access denied. Invalid user role.");
                }

                console.log(`User is ${userRole}. Login allowed.`);

                this.showSuccess();
                setTimeout(() => {
                    if (userRole === 'admin') {
                        window.location.href = './html/dashboard.html';
                    } else {
                        window.location.href = './html/farmer_dashboard.html';
                    }
                }, 1000);

            } catch (error) {
                console.error("Login Error:", error);

                let msg = "Login failed. Please check your credentials.";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    msg = "Incorrect email or password.";
                } else if (error.code === 'invalid-email') {
                    msg = "Please enter a valid email address.";
                } else if (error.code === 'auth/too-many-requests') {
                    msg = "Too many failed attempts. Please try again later.";
                } else if (error.message) {
                    msg = error.message;
                }

                this.showError(msg);
            } finally {
                this.setLoading(false);
            }
        }


    setLoading(isLoading) {
        this.isSubmitting = isLoading;
        if (isLoading) {
            this.submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...';
            this.submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
        } else {
            if(!this.isSuccess) {
                this.submitBtn.innerHTML = '<span>Sign in</span>';
                this.submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }
    }

    showSuccess() {
        this.isSuccess = true;
        this.submitBtn.classList.remove('bg-lime-600', 'hover:bg-lime-700');
        this.submitBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        this.submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Success';
    }

    showError(msg) {
        // 1. Set text
        this.errorText.textContent = msg;
        // 2. Unhide container
        this.errorContainer.classList.remove('hidden');
        
        // 3. Shake animation
        const card = document.querySelector('.bg-white.p-8');
        if(card) {
            card.classList.add('animate-[shake_0.5s_ease-in-out]');
            setTimeout(() => card.classList.remove('animate-[shake_0.5s_ease-in-out]'), 500);
        }
        
        // Reset button
        this.submitBtn.innerHTML = '<span>Sign in</span>';
        this.submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    }

    hideError() {
        if(this.errorContainer) {
            this.errorContainer.classList.add('hidden');
            this.errorText.textContent = '';
        }
    }
}

const authManager = new AuthManager();
window.auth = authManager;