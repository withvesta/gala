/**
 * Database module for the Pharmaceutical Gala Event.
 * Supports a LocalStorage fallback with realistic mock data (default),
 * and dynamically initializes Firebase Firestore if the configuration is populated.
 */

const firebaseConfig = {
    apiKey: "AIzaSyAILW1wZPvtkQfEoBccr5KlMLbhOM4Czfk",
    authDomain: "gala-b23c0.firebaseapp.com",
    projectId: "gala-b23c0",
    storageBucket: "gala-b23c0.firebasestorage.app",
    messagingSenderId: "561953677467",
    appId: "1:561953677467:web:5866d3d3abb83b8571663e",
    measurementId: "G-YH7LTW9CKS"
};

// Promise timeout helper to prevent hanging on Firestore network/initialization issues
function promiseTimeout(promise, ms) {
    let timeout = new Promise((resolve, reject) => {
        let id = setTimeout(() => {
            clearTimeout(id);
            reject(new Error(`Firebase operation timed out after ${ms}ms`));
        }, ms);
    });
    return Promise.race([promise, timeout]);
}

class GalaDatabase {
    constructor() {
        this.useFirebase = false;
        this.db = null;
        this.listeners = [];
        this.init();
    }

    init() {
        // Check if Firebase configuration is provided
        if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
            this.useFirebase = true;
            this.initFirebase();
        } else {
            console.log("Firebase config not found or incomplete. Using LocalStorage fallback with mock data.");
            this.initLocalStorage();
        }
    }

    async initFirebase() {
        try {
            // Dynamically import Firebase libraries from CDN
            await this.loadScript("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
            await this.loadScript("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js");

            // Initialize Firebase App
            const app = firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore(app);
            console.log("Firebase Firestore initialized successfully!");
        } catch (error) {
            console.error("Failed to initialize Firebase. Falling back to LocalStorage.", error);
            this.useFirebase = false;
            this.initLocalStorage();
        }
    }

    initLocalStorage() {
        if (!localStorage.getItem("gala_registrations")) {
            // Pre-populate with realistic mock registrations so the lottery reel and lists look fantastic immediately
            const mockData = [
                {
                    id: "mock-1",
                    name: "Olivia Carter",
                    email: "olivia.carter@pharmacy.edu",
                    regNo: "PHAM/M/1024/23/24",
                    year: "1",
                    code: "1001024",
                    timestamp: new Date(2026, 5, 1, 14, 30).toISOString()
                },
                {
                    id: "mock-2",
                    name: "Dr. Alexander Sterling",
                    email: "a.sterling@medresearch.org",
                    regNo: "PHAM/MK/5082/20/21",
                    year: "5",
                    code: "5005082",
                    timestamp: new Date(2026, 5, 2, 10, 15).toISOString()
                },
                {
                    id: "mock-3",
                    name: "Sophia Patel",
                    email: "spatel@clinicalcare.net",
                    regNo: "PHAM/M/3419/21/23",
                    year: "3",
                    code: "3003419",
                    timestamp: new Date(2026, 5, 3, 11, 45).toISOString()
                },
                {
                    id: "mock-4",
                    name: "Marcus Thorne",
                    email: "m.thorne@pharmaworld.com",
                    regNo: "PHAM/M/4096/20/22",
                    year: "4",
                    code: "4004096",
                    timestamp: new Date(2026, 5, 4, 16, 20).toISOString()
                },
                {
                    id: "mock-5",
                    name: "Dr. Elena Rostova",
                    email: "elena.r@biotechlabs.com",
                    regNo: "PHAM/MK/2205/22/24",
                    year: "2",
                    code: "2002205",
                    timestamp: new Date(2026, 5, 5, 9, 30).toISOString()
                },
                {
                    id: "mock-6",
                    name: "Daniel Kim",
                    email: "daniel.kim@healthsci.org",
                    regNo: "PHAM/M/1188/23/25",
                    year: "1",
                    code: "1001188",
                    timestamp: new Date(2026, 5, 6, 13, 10).toISOString()
                },
                {
                    id: "mock-7",
                    name: "Amara Nwosu",
                    email: "amara.n@therapeutics.co",
                    regNo: "PHAM/MK/3774/21/22",
                    year: "3",
                    code: "3003774",
                    timestamp: new Date(2026, 5, 7, 15, 50).toISOString()
                },
                {
                    id: "mock-8",
                    name: "Liam O'Connor",
                    email: "liam.oc@apothecary.ie",
                    regNo: "PHAM/M/5050/19/21",
                    year: "5",
                    code: "5005050",
                    timestamp: new Date(2026, 5, 8, 17, 0).toISOString()
                }
            ];
            localStorage.setItem("gala_registrations", JSON.stringify(mockData));
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Saves a registration record.
     * @param {Object} registrationData - contains name, email, regNo, year, code, timestamp
     */
    async saveRegistration(registrationData) {
        const record = {
            id: 'reg-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            timestamp: new Date().toISOString(),
            ...registrationData
        };

        if (this.useFirebase && this.db) {
            try {
                await promiseTimeout(this.db.collection("registrations").doc(record.id).set(record), 2500);
                this.triggerListeners();
                return record;
            } catch (error) {
                console.error("Firebase save failed, saving locally:", error);
            }
        }

        // LocalStorage Fallback
        const current = this.getLocalRegistrations();
        current.push(record);
        localStorage.setItem("gala_registrations", JSON.stringify(current));
        this.triggerListeners();
        return record;
    }

    /**
     * Deletes a registration record by ID.
     * @param {string} id 
     */
    async deleteRegistration(id) {
        if (this.useFirebase && this.db) {
            try {
                await promiseTimeout(this.db.collection("registrations").doc(id).delete(), 2500);
                this.triggerListeners();
                return true;
            } catch (error) {
                console.error("Firebase delete failed, deleting locally:", error);
            }
        }

        // LocalStorage Fallback
        let current = this.getLocalRegistrations();
        current = current.filter(record => record.id !== id);
        localStorage.setItem("gala_registrations", JSON.stringify(current));
        this.triggerListeners();
        return true;
    }

    /**
     * Gets all registration records.
     * @returns {Promise<Array>}
     */
    async getAllRegistrations() {
        if (this.useFirebase && this.db) {
            try {
                const snapshot = await promiseTimeout(this.db.collection("registrations").get(), 2500);
                const regs = [];
                snapshot.forEach(doc => regs.push(doc.data()));
                return regs;
            } catch (error) {
                console.error("Firebase fetch failed, reading from local:", error);
            }
        }
        return this.getLocalRegistrations();
    }

    getLocalRegistrations() {
        const data = localStorage.getItem("gala_registrations");
        return data ? JSON.parse(data) : [];
    }

    /**
     * Simple subscription mechanism to listen to updates.
     * @param {Function} callback 
     */
    subscribe(callback) {
        this.listeners.push(callback);
        // Call immediately with current data
        this.getAllRegistrations().then(data => callback(data));
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    triggerListeners() {
        this.getAllRegistrations().then(data => {
            this.listeners.forEach(cb => cb(data));
        });
    }
}

// Instantiate globally for simple use in other scripts
window.galaDb = new GalaDatabase();
