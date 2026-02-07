import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBiOPLoSBWiZx2tWe8hIGtneQJrW2oBMNg",
  authDomain: "calamansisys.firebaseapp.com",
  projectId: "calamansisys",
  storageBucket: "calamansisys.firebasestorage.app",
  messagingSenderId: "697637110296",
  appId: "1:697637110296:web:4e237bb99b3c6c6641b96d",
  measurementId: "G-8K8L6GYNCQ"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const secondaryApp = initializeApp(firebaseConfig, "SecondaryInstance");
const secondaryAuth = getAuth(secondaryApp);

export { app, analytics, db, auth, secondaryAuth };