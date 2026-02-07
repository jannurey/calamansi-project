import { app } from '../firebase-config.js'; // Removed the trailing space in path
import { 
    getAuth, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

// ------------------------------------------------------------------
// CONFIGURATION & CACHE KEYS
// ------------------------------------------------------------------
const GEMINI_API_KEY = "AIzaSyC_KSNVkDoOJEdOQhirt7XBNVAwhbC4ppk"; 

const USER_CACHE_KEY = 'calamansi_user_profile';
const SENSOR_CACHE_KEY = 'calamansi_latest_sensors';
const CHART_CACHE_KEY = 'calamansi_chart_cache';

const DB_CONFIG = {
    collection: 'dataCollectionSensor',
    fields: {
        temp: 'temperature',
        hum: 'humidity',
        soil: 'avgSoilMoisture',
        time: 'timestamp'
    }
};

const THRESHOLDS = {
    soil: { min: 20, critical: 18 },
    temp: { max: 32, critical: 35 }
};

class DataService {
    constructor() {
        this.collectionRef = collection(db, DB_CONFIG.collection);
    }

    listenToLatest(callback) {
        const q = query(
            this.collectionRef,
            orderBy(DB_CONFIG.fields.time, 'desc'),
            limit(1)
        );

        return onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                callback(snapshot.docs[0].data());
            }
        });
    }

    async fetchHistory(timeframe) {
        const now = new Date();
        let interval = 'hour';
        let startTime, endTime;

        switch (timeframe) {
      
            case 'weeks':
                startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                endTime = now;
                interval = 'day';
                break;

            case 'months':
                startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                endTime = now;
                interval = 'day';
                break;

            case 'days':
            default:
                startTime = new Date(now);
                startTime.setHours(8, 0, 0, 0);
                endTime = new Date(now);
                endTime.setHours(20, 50, 0, 0);
                interval = 'hour';
        }

        // ✅ NO where() — string-safe
        const q = query(
            this.collectionRef,
            orderBy(DB_CONFIG.fields.time, 'asc')
        );


        try {
            const snapshot = await getDocs(q);

            const rawData = snapshot.docs
                .map(doc => {
                    const data = doc.data();
                    const parsedTime = new Date(data[DB_CONFIG.fields.time]);

                    if (isNaN(parsedTime)) return null

                    return {
                        temp: data[DB_CONFIG.fields.temp],
                        hum: data[DB_CONFIG.fields.hum],
                        soil: data[DB_CONFIG.fields.soil],
                        time: parsedTime
                    };
                })
                .filter(d => d && d.time >= startTime && d.time <= endTime);

            // --------------------------------------------------
            // BUILD TIMELINE
            // --------------------------------------------------
            const timeline = [];
            const dataMap = new Map();
            let cursor = new Date(startTime);

            while (cursor <= endTime) {
                let label;

                if (interval === 'hour') {
                    label = cursor.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    cursor.setMinutes(cursor.getMinutes() + 10);
                } else {
                    label = cursor.toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric'
                    });
                    cursor.setDate(cursor.getDate() + 1);
                }

                timeline.push(label);
                dataMap.set(label, { temp: null, hum: null, soil: null });
            }

            // --------------------------------------------------
            // MAP DATA TO TIMELINE
            // --------------------------------------------------
            rawData.forEach(d => {
                const label =
                    interval === 'hour'
                        ? d.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : d.time.toLocaleDateString([], { month: 'short', day: 'numeric' });

                if (dataMap.has(label)) {
                    dataMap.set(label, {
                        temp: d.temp,
                        hum: d.hum,
                        soil: d.soil
                    });
                }
            });

            return timeline.map(label => ({
                label,
                ...dataMap.get(label)
            }));

        } catch (err) {
            console.error("Error fetching history:", err);
            return [];
        }
    }
}

// ------------------------------------------------------------------
// CHART CONTROLLER
// ------------------------------------------------------------------
class ChartController {
    constructor(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        this.ctx = canvas.getContext('2d');
        this.chart = null;
    }

    render(data) {
        if (!this.ctx) return;

        const chartData = {
            labels: data.map(d => d.label),
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: data.map(d => d.temp),
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'yTemp'
                },
                {
                    label: 'Soil Moisture (%)',
                    data: data.map(d => d.soil),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'yPct'
                },
                {
                    label: 'Humidity (%)',
                    data: data.map(d => d.hum),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.10,
                    yAxisID: 'yPct'
                }
            ]
        };

        if (this.chart) {
            this.chart.data = chartData;
            this.chart.update();
        } else {
            this.chart = new Chart(this.ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 20 } }
                    },
                    scales: {
                        x: {
                        ticks: { maxTicksLimit: 7, maxRotation: 0, autoSkip: true },
                        grid: { display: false }
                    },

                        yPct: { 
                            type: 'linear', display: true, position: 'left',
                            title: { display: true, text: 'Percentage (%)' },
                            min: 0, max: 100
                        },
                        yTemp: { 
                            type: 'linear', display: true, position: 'right', 
                            title: { display: true, text: 'Temperature (°C)' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }
    }
}

// ------------------------------------------------------------------
// MAIN APP & GEMINI LOGIC
// ------------------------------------------------------------------
class DashboardApp {
    constructor() {
        this.dataService = new DataService();
        this.chartController = new ChartController('sensorChart');
        
        this.latestReadings = null;

        const headings = document.querySelectorAll('h3');
        this.ui = {
            temp: headings[0],
            hum: headings[1],
            soil: headings[2],
            sidebarName: document.getElementById('user-display-name'),
            sidebarEmail: document.getElementById('user-display-email'),
            sidebarImg: document.getElementById('sidebar-avatar')
        };

        this.aiUi = {
            status: document.getElementById('ai-main-status'),
            desc: document.getElementById('ai-main-desc'),
            yield: document.getElementById('ai-yield-impact'),
            fert: document.getElementById('ai-fert-schedule'),
            btnAsk: document.getElementById('btn-ask-ai'),
            responseBox: document.getElementById('ai-response-box')
        };

        this.initAuthListener(); // Initialize listener for live user data
        this.loadSensorsFromCache();
        this.init();
    }

    initAuthListener() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                // Use profile cache for custom names, fallback to Firebase Display Name or generic Admin
                const cached = JSON.parse(localStorage.getItem(USER_CACHE_KEY) || '{}');
                const fullName = cached.firstName ? `${cached.firstName} ${cached.lastName}` : (user.displayName || "Admin");
                
                if (this.ui.sidebarName) this.ui.sidebarName.innerText = fullName;
                if (this.ui.sidebarEmail) this.ui.sidebarEmail.innerText = user.email;
                
                // Set photo if available in Firebase or cached custom profile
                if (user.photoURL && this.ui.sidebarImg) {
                    this.ui.sidebarImg.src = user.photoURL;
                } else if (cached.photoURL && this.ui.sidebarImg) {
                    this.ui.sidebarImg.src = cached.photoURL;
                }
            } else {
                // Redirect to login if not authenticated
                window.location.href = 'index.html';
            }
        });
    }

    loadSensorsFromCache() {
        const cached = localStorage.getItem(SENSOR_CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);
            this.updateCardsAndAI(data, true); 
        }
        
        const cachedChart = localStorage.getItem(CHART_CACHE_KEY);
        if (cachedChart) {
            this.chartController.render(JSON.parse(cachedChart));
        }
    }

    init() {
        this.initEventListeners();
        
        this.dataService.listenToLatest((data) => {
            this.latestReadings = data; 
            localStorage.setItem(SENSOR_CACHE_KEY, JSON.stringify(data)); 
            this.updateCardsAndAI(data);
        });

        this.updateChart('hours');
    }

    initEventListeners() {
        const timeButtons = document.querySelectorAll('#timeframe-controls button[data-tf]');
        timeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                timeButtons.forEach(b => {
                    b.classList.remove('chart-filter-active', 'shadow-sm', 'shadow-lime-200');
                    b.classList.add('chart-filter-inactive');
                });
                e.target.classList.remove('chart-filter-inactive');
                e.target.classList.add('chart-filter-active', 'shadow-sm', 'shadow-lime-200');
                this.updateChart(e.target.dataset.tf);
            });
        });

        if (this.aiUi.btnAsk) {
            this.aiUi.btnAsk.addEventListener('click', () => {
                this.generateGeminiReport();
            });
        }
    }

    async updateChart(timeframe) {
        const historyData = await this.dataService.fetchHistory(timeframe);
        if (historyData.length > 0) {
            localStorage.setItem(CHART_CACHE_KEY, JSON.stringify(historyData));
            this.chartController.render(historyData);
        }
    }

    updateCardsAndAI(data, isCached = false) {
        if (!data) return;
        this.ui.temp.innerText = `${data[DB_CONFIG.fields.temp] ?? '--'}°C`;
        this.ui.hum.innerText = `${data[DB_CONFIG.fields.hum] ?? '--'}%`;
        this.ui.soil.innerText = `${data[DB_CONFIG.fields.soil] ?? '--'}%`;
        
        this.ui.temp.style.opacity = isCached ? "0.6" : "1";

        this.runRuleBasedAnalysis(data);
    }

    runRuleBasedAnalysis(data) {
        const soilVal = data[DB_CONFIG.fields.soil];
        if (soilVal == null || !this.aiUi.status) return;

        if (soilVal < THRESHOLDS.soil.critical) {
            this.aiUi.status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-red-500 mr-2"></i>Critical: Water Stress`;
            this.aiUi.desc.innerHTML = `Soil moisture is critical at <strong>${soilVal}%</strong>.`;
            this.aiUi.yield.innerText = "Yield risk: Severe (-15%) fruit drop likely.";
            this.aiUi.fert.innerText = "Do NOT fertilize. Rehydrate first.";
        } else if (soilVal < THRESHOLDS.soil.min) {
            this.aiUi.status.innerHTML = `<i class="fa-solid fa-circle-exclamation text-amber-500 mr-2"></i>Warning: Low Moisture`;
            this.aiUi.desc.innerHTML = `Soil moisture (${soilVal}%) is below optimal target.`;
            this.aiUi.yield.innerText = "Potential fruit sizing reduction.";
            this.aiUi.fert.innerText = "Schedule irrigation before applying nutrients.";
        } else {
            this.aiUi.status.innerHTML = `<i class="fa-solid fa-check-circle text-green-500 mr-2"></i>System Optimal`;
            this.aiUi.desc.innerHTML = `Sensors reporting ideal growth parameters.`;
            this.aiUi.yield.innerText = "Conditions favor maximum fruit retention.";
            this.aiUi.fert.innerText = "Safe to apply scheduled nutrients.";
        }
    }

    async generateGeminiReport() {
        if (!this.latestReadings) {
            alert("Waiting for sensor data connection...");
            return;
        }

        const box = this.aiUi.responseBox;
        const btn = this.aiUi.btnAsk;

        box.classList.remove('hidden');
        box.innerHTML = `<div class="flex items-center gap-3 text-slate-500">
            <i class="fa-solid fa-circle-notch fa-spin text-indigo-600"></i> 
            <span>Analyzing data with Gemini 2.5 Flash...</span>
        </div>`;
        btn.disabled = true;

        try {
            const promptText = `
            Act as an expert agronomist for Calamansi.
            Current Sensor Data:
            - Soil Moisture: ${this.latestReadings[DB_CONFIG.fields.soil]}%
            - Temperature: ${this.latestReadings[DB_CONFIG.fields.temp]}°C
            - Humidity: ${this.latestReadings[DB_CONFIG.fields.hum]}%

            Task:
            Provide exactly 3 short, actionable recommendations for farmers.`.trim();

            const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }]
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(`${data.error.status}: ${data.error.message}`);
            }

            const markdownText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response generated.";

            box.innerHTML = markdownText
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\n/g, '<br>');
            box.classList.add("border-indigo-200", "bg-indigo-50");

        } catch (error) {
            console.error("Gemini Error:", error);
            box.innerHTML = `<span class="text-red-500 font-bold">Analysis Failed</span><br>${error.message}`;
        } finally {
            btn.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DashboardApp();
});