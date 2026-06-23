/**
 * PULSE - Application State Management System
 */
let appState = {
    profile: { age: 30, gender: 'male', weight: 70, height: 170, goalWeight: 65 },
    todayLogs: [], // Array items: { id, type: 'food'|'exercise', name, calories }
    history: {},   // Keyed by YYYY-MM-DD: { weight, consumed, burned }
    streak: 0,
    lastLogDate: ""
};

// Selection Indicators & Constants
let chartInstance = null;
const quotes = [
    "Your body can stand almost anything. It's your mind that you have to convince.",
    "Fitness is not about being better than someone else. It's about being better than you used to be.",
    "What eats your time drains your body. Plan your fuel correctly.",
    "Success starts with self-discipline. Track your progress daily.",
    "The only bad workout is the one that didn't happen."
];

// Document Ready Initialization Loop
document.addEventListener("DOMContentLoaded", () => {
    loadStateFromStorage();
    checkWeeklyResetCondition();
    initializeNotificationPermissions();
    rotateMotivationalQuotes();
    
    setupEventListeners();
    renderAllDashboardComponents();
});

/* --- APPLICATION STORAGE & RECOVERY --- */
function loadStateFromStorage() {
    const saved = localStorage.getItem("pulse_fitness_state");
    if (saved) {
        try {
            appState = JSON.parse(saved);
            if (!appState.history) appState.history = {};
            if (!appState.todayLogs) appState.todayLogs = [];
        } catch (e) {
            console.error("State recovery corrupted, using defaults.", e);
        }
    } else {
        // Initialize sample record structural placeholder if fresh
        const todayStr = getTodayDateString();
        appState.lastLogDate = todayStr;
    }
}

function saveStateToStorage() {
    localStorage.setItem("pulse_fitness_state", JSON.stringify(appState));
}

/* --- AUTOMATIC LOG RESET & STREAKS TIMELINES --- */
function checkWeeklyResetCondition() {
    const todayStr = getTodayDateString();
    
    // Commit current working log context states directly to historical nodes
    updateHistoricalRecordForDate(todayStr);

    if (appState.lastLogDate && appState.lastLogDate !== todayStr) {
        const lastDate = new Date(appState.lastLogDate);
        const todayDate = new Date(todayStr);
        
        // Calculate days differences
        const diffTime = Math.abs(todayDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            appState.streak += 1;
        } else if (diffDays > 1) {
            appState.streak = 0; // Break Streak if missing days
        }
        
        // Check structural weekly target resets (Every Monday)
        if (todayDate.getDay() === 1) { 
            // It's Monday! Flush current log structures for fresh tracking start.
            appState.todayLogs = [];
        }
        
        appState.lastLogDate = todayStr;
        saveStateToStorage();
    }
}

function updateHistoricalRecordForDate(dateStr) {
    let consumed = 0;
    let burned = 0;
    appState.todayLogs.forEach(item => {
        if(item.type === 'food') consumed += item.calories;
        if(item.type === 'exercise') burned += item.calories;
    });

    appState.history[dateStr] = {
        weight: appState.profile.weight || 70,
        consumed: consumed,
        burned: burned
    };
    saveStateToStorage();
}

/* --- CALCULATIONS ENGINES (BMR / TDEE / BMI / ETA) --- */
function calculateMetrics() {
    const p = appState.profile;
    if(!p.weight || !p.height || !p.age) return { bmi: 0, category: "--", tdee: 0 };

    // BMI Calculation
    const heightInMeters = p.height / 100;
    const bmi = p.weight / (heightInMeters * heightInMeters);
    let category = "Normal";
    
    if (bmi < 18.5) category = "Underweight";
    else if (bmi < 25) category = "Normal";
    else if (bmi < 30) category = "Overweight";
    else category = "Obese";

    // BMR Calculation using Mifflin-St Jeor Equation
    let bmr = (10 * p.weight) + (6.25 * p.height) - (5 * p.age);
    if (p.gender === 'male') {
        bmr += 5;
    } else {
        bmr -= 161;
    }
    
    // TDEE Base Value assumes Light Activity Multiplier (1.375) minus Weight Loss Deficit Target (-500 kcal)
    const targetTdee = Math.round((bmr * 1.375) - 500);

    return { bmi: bmi.toFixed(1), category, tdee: targetTdee };
}

function calculateEstimatedDaysToGoal() {
    const p = appState.profile;
    if(!p.weight || !p.goalWeight || p.weight <= p.goalWeight) return "Goal Met or Not Configured";
    
    const weightDiff = p.weight - p.goalWeight;
    // Standard safe weight loss parameter calculation standard ~0.5kg per week via standard deficit parameters
    const safeWeeks = weightDiff / 0.5;
    const totalDays = Math.round(safeWeeks * 7);
    
    return `Est. ${totalDays} days to reach target (${Math.round(safeWeeks)} weeks)`;
}

/* --- PRESENTATION RENDERING CORE CONTROLLERS --- */
function renderAllDashboardComponents() {
    // Fill Profiles Fields
    document.getElementById("age").value = appState.profile.age || "";
    document.getElementById("gender").value = appState.profile.gender || "male";
    document.getElementById("weight").value = appState.profile.weight || "";
    document.getElementById("height").value = appState.profile.height || "";
    document.getElementById("goal-weight").value = appState.profile.goalWeight || "";
    
    document.getElementById("streak-count").innerText = appState.streak || 0;

    // Run Core Performance Calculations
    const metrics = calculateMetrics();
    document.getElementById("bmi-val").innerText = metrics.bmi || "--";
    document.getElementById("bmi-cat").innerText = metrics.category || "--";
    document.getElementById("tdee-val").innerText = metrics.tdee || "--";
    document.getElementById("cal-target").innerText = metrics.tdee || "0";
    document.getElementById("eta-display").innerText = calculateEstimatedDaysToGoal();

    // Calculate Daily Progress Cycles
    let consumed = 0;
    let burned = 0;
    
    const elementsList = document.getElementById("today-items-list");
    elementsList.innerHTML = "";

    appState.todayLogs.forEach(item => {
        if(item.type === 'food') consumed += item.calories;
        if(item.type === 'exercise') burned += item.calories;

        const li = document.createElement("li");
        li.className = `log-item ${item.type === 'exercise' ? 'exercise' : ''}`;
        li.innerHTML = `
            <span>${item.name} (<strong>${item.calories} kcal</strong>)</span>
            <div class="log-item-actions">
                <button class="btn-delete" onclick="removeTrackingItem('${item.id}')"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        elementsList.appendChild(li);
    });

    const netCalories = consumed - burned;
    const remaining = metrics.tdee - netCalories;
    
    document.getElementById("cal-consumed").innerText = consumed;
    document.getElementById("cal-burned").innerText = burned;
    
    const remainingEl = document.getElementById("cal-remaining");
    const remainingLbl = document.getElementById("cal-remaining-label");
    const progressBar = document.getElementById("calorie-progress");

    if (remaining >= 0) {
        remainingEl.innerText = remaining;
        remainingLbl.innerText = "Remaining";
        remainingLbl.className = "bubble-label";
        progressBar.classList.remove("overlimit");
    } else {
        remainingEl.innerText = Math.abs(remaining);
        remainingLbl.innerText = "Surplus!";
        remainingLbl.className = "bubble-label text-burn";
        progressBar.classList.add("overlimit");
    }

    // Dynamic Progress Fill Calculations
    const pct = metrics.tdee > 0 ? Math.min((netCalories / metrics.tdee) * 100, 100) : 0;
    progressBar.style.width = `${pct < 0 ? 0 : pct}%`;

    // Rebuild Table Histories and Analytic Charts
    renderHistoryTable();
    renderWeeklySummaries();
    rebuildAnalyticsChart();
}

function renderWeeklySummaries() {
    let weekConsumed = 0;
    let weekBurned = 0;
    
    // Sum trailing 7 calendar elements safely
    const dates = Object.keys(appState.history).sort().slice(-7);
    dates.forEach(d => {
        weekConsumed += appState.history[d].consumed || 0;
        weekBurned += appState.history[d].burned || 0;
    });

    const targetDeficit = (500 * dates.length); // 500 kcal baseline target tracking calculation
    
    document.getElementById("week-consumed").innerText = `${weekConsumed} kcal`;
    document.getElementById("week-burned").innerText = `${weekBurned} kcal`;
    document.getElementById("week-deficit").innerText = `${weekBurned + targetDeficit} kcal`;
}

function renderHistoryTable(filterKeyword = "") {
    const tbody = document.getElementById("history-table-body");
    tbody.innerHTML = "";

    const sortedDates = Object.keys(appState.history).sort((a,b) => new Date(b) - new Date(a));
    
    sortedDates.forEach(dateStr => {
        if(filterKeyword && !dateStr.includes(filterKeyword)) return;

        const data = appState.history[dateStr];
        const net = data.consumed - data.burned;
        const statusStr = net <= (calculateMetrics().tdee) ? "Deficit Dynamic" : "Surplus Alert";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${dateStr}</strong></td>
            <td>${data.weight} kg</td>
            <td class="text-gain">+${data.consumed}</td>
            <td class="text-burn">-${data.burned}</td>
            <td>${net} kcal</td>
            <td><span class="badge">${statusStr}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

/* --- GRAPHICAL ANALYTICS GENERATION --- */
function rebuildAnalyticsChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    const sortedDates = Object.keys(appState.history).sort().slice(-7); // Last 7 items track

    const weightData = sortedDates.map(d => appState.history[d].weight);
    const calorieData = sortedDates.map(d => appState.history[d].consumed - appState.history[d].burned);

    if (chartInstance) {
        chartInstance.destroy();
    }

    // Chart.js Configuration
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [
                {
                    label: 'Net Calories (kcal)',
                    data: calorieData,
                    borderColor: '#38bdf8',
                    backgroundColor: 'rgba(56, 189, 248, 0.1)',
                    yAxisID: 'yCal',
                    tension: 0.3
                },
                {
                    label: 'Weight (kg)',
                    data: weightData,
                    borderColor: '#f43f5e',
                    backgroundColor: 'transparent',
                    yAxisID: 'yWeight',
                    borderDash: [5, 5],
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                yCal: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
                yWeight: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } }
            }
        }
    });
}

/* --- INTERACTIVE ACTION EVENT HANDLERS --- */
function setupEventListeners() {
    // Profile Updates Handles
    document.getElementById("profile-form").addEventListener("submit", (e) => {
        e.preventDefault();
        appState.profile.age = parseInt(document.getElementById("age").value);
        appState.profile.gender = document.getElementById("gender").value;
        appState.profile.weight = parseFloat(document.getElementById("weight").value);
        appState.profile.height = parseInt(document.getElementById("height").value);
        appState.profile.goalWeight = parseFloat(document.getElementById("goal-weight").value);
        
        const todayStr = getTodayDateString();
        updateHistoricalRecordForDate(todayStr);
        saveStateToStorage();
        renderAllDashboardComponents();
    });

    // Add Food Logs
    document.getElementById("food-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const nameEl = document.getElementById("food-name");
        const calEl = document.getElementById("food-cals");

        appState.todayLogs.push({
            id: Date.now().toString(),
            type: 'food',
            name: nameEl.value,
            calories: parseInt(calEl.value)
        });

        nameEl.value = "";
        calEl.value = "";
        
        updateHistoricalRecordForDate(getTodayDateString());
        renderAllDashboardComponents();
    });

    // Add Exercise Logs
    document.getElementById("exercise-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const nameEl = document.getElementById("exercise-name");
        const calEl = document.getElementById("exercise-cals");

        appState.todayLogs.push({
            id: Date.now().toString(),
            type: 'exercise',
            name: nameEl.value,
            calories: parseInt(calEl.value)
        });

        nameEl.value = "";
        calEl.value = "";

        updateHistoricalRecordForDate(getTodayDateString());
        renderAllDashboardComponents();
    });

    // Theme Customizer Logic
    document.getElementById("theme-toggle").addEventListener("click", () => {
        const root = document.documentElement;
        const currentTheme = root.getAttribute("data-theme");
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", nextTheme);
        document.getElementById("theme-toggle").innerHTML = nextTheme === "dark" ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });

    // Live Search Filter Handler
    document.getElementById("history-search").addEventListener("input", (e) => {
        renderHistoryTable(e.target.value.trim());
    });

    // Export Process Actions
    document.getElementById("btn-export").addEventListener("click", exportHistoryToCSV);
    
    // Backup and Restore Actions
    document.getElementById("btn-backup").addEventListener("click", backupDataAsJSON);
    document.getElementById("btn-restore-trigger").addEventListener("click", () => {
        document.getElementById("file-restore").click();
    });
    document.getElementById("file-restore").addEventListener("change", restoreDataFromJSON);
}

function removeTrackingItem(id) {
    appState.todayLogs = appState.todayLogs.filter(item => item.id !== id);
    updateHistoricalRecordForDate(getTodayDateString());
    renderAllDashboardComponents();
}

/* --- FILE DATA MANAGEMENT (CSV EXPORT & BACKUPS) --- */
function exportHistoryToCSV() {
    let csvRows = ["Date,Weight(kg),Consumed(kcal),Burned(kcal),Net(kcal)"];
    
    Object.keys(appState.history).sort().forEach(date => {
        const h = appState.history[date];
        csvRows.push(`${date},${h.weight},${h.consumed},${h.burned},${h.consumed - h.burned}`);
    });

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `pulse_fitness_history_${getTodayDateString()}.csv`);
    a.click();
}

function backupDataAsJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `pulse_backup_${getTodayDateString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function restoreDataFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if(parsed.profile && parsed.history) {
                appState = parsed;
                saveStateToStorage();
                renderAllDashboardComponents();
                alert("Data restoration executed successfully!");
            } else {
                alert("Invalid format structure detected inside JSON file configuration profiles.");
            }
        } catch (err) {
            alert("Failed to safely read the backup schema target.");
        }
    };
    reader.readAsText(file);
}

/* --- UTILITIES & BROWSER NOTIFICATIONS --- */
function getTodayDateString() {
    const d = new Date();
    return d.toISOString().split('T')[0];
}

function rotateMotivationalQuotes() {
    const rIdx = Math.floor(Math.random() * quotes.length);
    document.getElementById("motivational-quote").innerText = `"${quotes[rIdx]}"`;
}

function initializeNotificationPermissions() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                scheduleDailyLoggingReminder();
            }
        });
    } else if ("Notification" in window && Notification.permission === "granted") {
        scheduleDailyLoggingReminder();
    }
}

function scheduleDailyLoggingReminder() {
    // Simple check trigger simulation simulating routine push requests notice alert boundaries
    setTimeout(() => {
        if(appState.todayLogs.length === 0) {
            new Notification("PULSE Fitness Tracker", {
                body: "Don't forget to track your nutritional intake items and targets today!",
                icon: "https://cdn-icons-png.flaticon.com/512/709/709612.png"
            });
        }
    }, 1000 * 60 * 60 * 4); // Standard hourly contextual verification notification push windows loops (~4 Hours Check)
}