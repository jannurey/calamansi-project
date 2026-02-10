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

            // Check if user needs to change password
            if (userData.needsPasswordChange === true && userRole === 'user') {
                // Show password change prompt
                this.showPasswordChangePrompt(user, userData);
            } else {
                this.showSuccess();
                setTimeout(() => {
                    if (userRole === 'admin') {
                        window.location.href = './html/dashboard.html';
                    } else {
                        window.location.href = './html/farmer_dashboard.html';
                    }
                }, 1000);
            }

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

    showPasswordChangePrompt(user, userData) {
        // Create and show password change modal
        this.createPasswordChangeModal(user, userData);
    }

    createPasswordChangeModal(user, userData) {
        // Remove existing modal if present
        const existingModal = document.getElementById('passwordChangeModal');
        if (existingModal) existingModal.remove();
        
        // Create modal HTML
        const modalHTML = `
            <div id="passwordChangeModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-[fadeIn_0.3s_ease-out]">
                    <div class="mb-4">
                        <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-3">
                            <i class="fa-solid fa-key text-xl"></i>
                        </div>
                        <h3 class="text-xl font-bold text-slate-800">Change Your Password</h3>
                        <p class="text-sm text-slate-500">It's recommended to change your default password for security.</p>
                    </div>
                    
                    <div class="space-y-4 mb-6">
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                            <input type="password" id="newPassword" required 
                                class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 transition" 
                                placeholder="Enter new password">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                            <input type="password" id="confirmNewPassword" required 
                                class="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500 transition" 
                                placeholder="Confirm new password">
                        </div>
                    </div>
                    
                    <div class="flex gap-3">
                        <button id="skipPasswordBtn" class="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
                            Skip for now
                        </button>
                        <button id="changePasswordBtn" class="flex-1 px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 transition text-sm font-medium">
                            Change Password
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Add event listeners
        document.getElementById('skipPasswordBtn').addEventListener('click', () => {
            this.completeLogin(userData.role?.toLowerCase());
            document.getElementById('passwordChangeModal').remove();
        });
        
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            this.handleChangePassword(user, userData);
        });
    }

    async handleChangePassword(user, userData) {
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;
        
        if (!newPassword || !confirmNewPassword) {
            alert('Please fill in both password fields.');
            return;
        }
        
        if (newPassword !== confirmNewPassword) {
            alert('Passwords do not match.');
            return;
        }
        
        if (newPassword.length < 6) {
            alert('Password must be at least 6 characters long.');
            return;
        }
        
        try {
            // Update the user's password
            const { updatePassword } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js");
            await updatePassword(user, newPassword);
            
            // Update the needsPasswordChange flag in Firestore
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
            await updateDoc(doc(db, "users", user.uid), { needsPasswordChange: false });
            
            alert('Password changed successfully!');
            
            // Complete login
            this.completeLogin(userData.role?.toLowerCase());
            document.getElementById('passwordChangeModal').remove();
        } catch (error) {
            console.error('Error changing password:', error);
            alert('Error changing password: ' + error.message);
        }
    }

    completeLogin(userRole) {
        this.showSuccess();
        setTimeout(() => {
            if (userRole === 'admin') {
                window.location.href = './html/dashboard.html';
            } else {
                window.location.href = './html/farmer_dashboard.html';
            }
        }, 1000);
    }
}

const authManager = new AuthManager();
window.auth = authManager;