/**
 * FitmakByTerTer - Application State Management System
 * Daily reset: every midnight → saves to history
 * Weekly reset: every Sunday 00:00 → clears weekly summary
 */
let appState = {
    profile: { age: 30, gender: 'male', weight: 70, height: 170, goalWeight: 65 },
    todayLogs: [],
    history: {},
    streak: 0,
    lastLogDate: "",
    lastWeeklyReset: ""
};

let chartInstance = null;
const quotes = [
    "Your body can stand almost anything. It's your mind that you have to convince.",
    "Fitness is not about being better than someone else. It's about being better than you used to be.",
    "What eats your time drains your body. Plan your fuel correctly.",
    "Success starts with self-discipline. Track your progress daily.",
    "The only bad workout is the one that didn't happen."
];

document.addEventListener("DOMContentLoaded", () => {
    loadStateFromStorage();
    checkDailyReset();
    checkWeeklyReset();
    scheduleMidnightReset();
    scheduleWeeklyReset();
    initializeNotificationPermissions();
    rotateMotivationalQuotes();
    setupEventListeners();
    renderAllDashboardComponents();
});

/* --- STORAGE --- */
function loadStateFromStorage() {
    const saved = localStorage.getItem("fitmak_state");
    if (saved) {
        try {
            appState = JSON.parse(saved);
            if (!appState.history) appState.history = {};
            if (!appState.todayLogs) appState.todayLogs = [];
            if (!appState.lastWeeklyReset) appState.lastWeeklyReset = "";
        } catch (e) {
            console.error("State recovery failed, using defaults.", e);
        }
    } else {
        appState.lastLogDate = getTodayDateString();
        appState.lastWeeklyReset = getSundayDateString();
    }
}

function saveStateToStorage() {
    localStorage.setItem("fitmak_state", JSON.stringify(appState));
}

/* --- DAILY RESET: ทุกเที่ยงคืน --- */
function checkDailyReset() {
    const todayStr = getTodayDateString();

    // บันทึกข้อมูลวันนี้ลง history เสมอ
    updateHistoricalRecordForDate(todayStr);

    if (appState.lastLogDate && appState.lastLogDate !== todayStr) {
        const lastDate = new Date(appState.lastLogDate);
        const todayDate = new Date(todayStr);
        const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

        // อัปเดต streak
        if (diffDays === 1) {
            appState.streak += 1;
        } else if (diffDays > 1) {
            appState.streak = 0;
        }

        // รีเซต log วันใหม่
        appState.todayLogs = [];
        appState.lastLogDate = todayStr;
        saveStateToStorage();

        showToast("🌙 วันใหม่เริ่มแล้ว! ข้อมูลเมื่อวานถูกบันทึกเรียบร้อย");
    } else if (!appState.lastLogDate) {
        appState.lastLogDate = todayStr;
        saveStateToStorage();
    }
}

function performDailyReset() {
    const todayStr = getTodayDateString();

    // บันทึก log ปัจจุบันก่อนรีเซต
    updateHistoricalRecordForDate(appState.lastLogDate || todayStr);

    // อัปเดต streak
    appState.streak += 1;

    // รีเซต log และขึ้นวันใหม่
    appState.todayLogs = [];
    appState.lastLogDate = todayStr;
    saveStateToStorage();
    renderAllDashboardComponents();
    showToast("🌙 เที่ยงคืนแล้ว! ข้อมูลถูกบันทึก และเริ่มต้นวันใหม่");
}

function scheduleMidnightReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow - now;

    setTimeout(() => {
        performDailyReset();
        // ตั้ง interval ทุก 24 ชั่วโมงหลังจากนั้น
        setInterval(performDailyReset, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
}

/* --- WEEKLY RESET: ทุกวันอาทิตย์ 00:00 --- */
function getSundayDateString() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const diff = now.getDate() - day;
    const sunday = new Date(now.setDate(diff));
    return sunday.toISOString().split('T')[0];
}

function checkWeeklyReset() {
    const currentSunday = getSundayDateString();
    if (appState.lastWeeklyReset !== currentSunday) {
        performWeeklyReset(currentSunday);
    }
}

function performWeeklyReset(sundayStr) {
    // เก็บ weekly summary ก่อนรีเซต
    const weekSummary = computeWeekSummary();
    if (!appState.weeklyArchive) appState.weeklyArchive = [];
    if (weekSummary.totalDays > 0) {
        appState.weeklyArchive.push({
            weekEnding: appState.lastWeeklyReset || sundayStr,
            ...weekSummary
        });
    }

    appState.lastWeeklyReset = sundayStr;
    saveStateToStorage();
    renderAllDashboardComponents();

    if (sundayStr !== getSundayDateString()) return; // ไม่ toast ถ้าเป็นการโหลดครั้งแรก
    showToast("📅 รีเซตรายสัปดาห์แล้ว! สัปดาห์ใหม่เริ่มต้น");
}

function scheduleWeeklyReset() {
    const now = new Date();
    // คำนวณวันอาทิตย์หน้า 00:00
    const nextSunday = new Date(now);
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0);
    const msUntilSunday = nextSunday - now;

    setTimeout(() => {
        const sundayStr = getTodayDateString();
        performWeeklyReset(sundayStr);
        showToast("🔄 รีเซตรายสัปดาห์! เริ่มต้นสัปดาห์ใหม่");
        // ทำซ้ำทุก 7 วัน
        setInterval(() => {
            performWeeklyReset(getTodayDateString());
            showToast("🔄 รีเซตรายสัปดาห์! เริ่มต้นสัปดาห์ใหม่");
        }, 7 * 24 * 60 * 60 * 1000);
    }, msUntilSunday);
}

function computeWeekSummary() {
    const currentSunday = new Date(getSundayDateString());
    let totalConsumed = 0, totalBurned = 0, totalDays = 0;
    Object.keys(appState.history).forEach(dateStr => {
        const d = new Date(dateStr);
        const diff = Math.round((currentSunday - d) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff < 7) {
            totalConsumed += appState.history[dateStr].consumed || 0;
            totalBurned += appState.history[dateStr].burned || 0;
            totalDays++;
        }
    });
    return { totalConsumed, totalBurned, totalDays };
}

/* --- HISTORY --- */
function updateHistoricalRecordForDate(dateStr) {
    let consumed = 0;
    let burned = 0;
    appState.todayLogs.forEach(item => {
        if (item.type === 'food') consumed += item.calories;
        if (item.type === 'exercise') burned += item.calories;
    });
    appState.history[dateStr] = {
        weight: appState.profile.weight || 70,
        consumed,
        burned
    };
    saveStateToStorage();
}

/* --- CALCULATIONS --- */
function calculateMetrics() {
    const p = appState.profile;
    if (!p.weight || !p.height || !p.age) return { bmi: 0, category: "--", tdee: 0 };

    const heightInMeters = p.height / 100;
    const bmi = p.weight / (heightInMeters * heightInMeters);
    let category = "Normal";
    if (bmi < 18.5) category = "Underweight";
    else if (bmi < 25) category = "Normal";
    else if (bmi < 30) category = "Overweight";
    else category = "Obese";

    let bmr = (10 * p.weight) + (6.25 * p.height) - (5 * p.age);
    bmr += p.gender === 'male' ? 5 : -161;
    const targetTdee = Math.round((bmr * 1.375) - 500);

    return { bmi: bmi.toFixed(1), category, tdee: targetTdee };
}

function calculateEstimatedDaysToGoal() {
    const p = appState.profile;
    if (!p.weight || !p.goalWeight || p.weight <= p.goalWeight) return "Goal Met or Not Configured";
    const weightDiff = p.weight - p.goalWeight;
    const safeWeeks = weightDiff / 0.5;
    const totalDays = Math.round(safeWeeks * 7);
    return `Est. ${totalDays} days to reach target (${Math.round(safeWeeks)} weeks)`;
}

/* --- RENDERING --- */
function renderAllDashboardComponents() {
    document.getElementById("age").value = appState.profile.age || "";
    document.getElementById("gender").value = appState.profile.gender || "male";
    document.getElementById("weight").value = appState.profile.weight || "";
    document.getElementById("height").value = appState.profile.height || "";
    document.getElementById("goal-weight").value = appState.profile.goalWeight || "";
    document.getElementById("streak-count").innerText = appState.streak || 0;

    const metrics = calculateMetrics();
    document.getElementById("bmi-val").innerText = metrics.bmi || "--";
    document.getElementById("bmi-cat").innerText = metrics.category || "--";
    document.getElementById("tdee-val").innerText = metrics.tdee || "--";
    document.getElementById("cal-target").innerText = metrics.tdee || "0";
    document.getElementById("eta-display").innerText = calculateEstimatedDaysToGoal();

    let consumed = 0;
    let burned = 0;
    const elementsList = document.getElementById("today-items-list");
    elementsList.innerHTML = "";

    appState.todayLogs.forEach(item => {
        if (item.type === 'food') consumed += item.calories;
        if (item.type === 'exercise') burned += item.calories;

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

    const pct = metrics.tdee > 0 ? Math.min((netCalories / metrics.tdee) * 100, 100) : 0;
    progressBar.style.width = `${pct < 0 ? 0 : pct}%`;

    renderHistoryTable();
    renderWeeklySummaries();
    rebuildAnalyticsChart();
}

function renderWeeklySummaries() {
    let weekConsumed = 0;
    let weekBurned = 0;
    const dates = Object.keys(appState.history).sort().slice(-7);
    dates.forEach(d => {
        weekConsumed += appState.history[d].consumed || 0;
        weekBurned += appState.history[d].burned || 0;
    });
    const targetDeficit = 500 * dates.length;
    document.getElementById("week-consumed").innerText = `${weekConsumed} kcal`;
    document.getElementById("week-burned").innerText = `${weekBurned} kcal`;
    document.getElementById("week-deficit").innerText = `${weekBurned + targetDeficit} kcal`;
}

function renderHistoryTable(filterKeyword = "") {
    const tbody = document.getElementById("history-table-body");
    tbody.innerHTML = "";
    const sortedDates = Object.keys(appState.history).sort((a, b) => new Date(b) - new Date(a));
    sortedDates.forEach(dateStr => {
        if (filterKeyword && !dateStr.includes(filterKeyword)) return;
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

function rebuildAnalyticsChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    const sortedDates = Object.keys(appState.history).sort().slice(-7);
    const weightData = sortedDates.map(d => appState.history[d].weight);
    const calorieData = sortedDates.map(d => appState.history[d].consumed - appState.history[d].burned);

    if (chartInstance) chartInstance.destroy();

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

/* --- EVENT LISTENERS --- */
function setupEventListeners() {
    document.getElementById("profile-form").addEventListener("submit", (e) => {
        e.preventDefault();
        appState.profile.age = parseInt(document.getElementById("age").value);
        appState.profile.gender = document.getElementById("gender").value;
        appState.profile.weight = parseFloat(document.getElementById("weight").value);
        appState.profile.height = parseInt(document.getElementById("height").value);
        appState.profile.goalWeight = parseFloat(document.getElementById("goal-weight").value);
        updateHistoricalRecordForDate(getTodayDateString());
        saveStateToStorage();
        renderAllDashboardComponents();
    });

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

    document.getElementById("theme-toggle").addEventListener("click", () => {
        const root = document.documentElement;
        const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", nextTheme);
        document.getElementById("theme-toggle").innerHTML = nextTheme === "dark"
            ? '<i class="fa-solid fa-sun"></i>'
            : '<i class="fa-solid fa-moon"></i>';
    });

    document.getElementById("history-search").addEventListener("input", (e) => {
        renderHistoryTable(e.target.value.trim());
    });

    document.getElementById("btn-export").addEventListener("click", exportHistoryToCSV);
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

/* --- FILE MANAGEMENT --- */
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
    a.setAttribute('download', `fitmak_history_${getTodayDateString()}.csv`);
    a.click();
}

function backupDataAsJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `fitmak_backup_${getTodayDateString()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function restoreDataFromJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.profile && parsed.history) {
                appState = parsed;
                saveStateToStorage();
                renderAllDashboardComponents();
                showToast("✅ กู้คืนข้อมูลสำเร็จ!");
            } else {
                alert("รูปแบบไฟล์ไม่ถูกต้อง");
            }
        } catch (err) {
            alert("ไม่สามารถอ่านไฟล์ backup ได้");
        }
    };
    reader.readAsText(file);
}

/* --- UTILITIES --- */
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

function rotateMotivationalQuotes() {
    const rIdx = Math.floor(Math.random() * quotes.length);
    document.getElementById("motivational-quote").innerText = `"${quotes[rIdx]}"`;
}

function showToast(message) {
    let toast = document.getElementById("fitmak-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "fitmak-toast";
        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: #1e293b; color: #f8fafc; padding: 14px 24px;
            border-radius: 12px; border: 1px solid #38bdf8;
            font-size: 0.95rem; font-weight: 600; z-index: 9999;
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
            transition: opacity 0.4s ease;
        `;
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.style.opacity = "1";
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => { toast.style.opacity = "0"; }, 3500);
}

function initializeNotificationPermissions() {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") scheduleDailyLoggingReminder();
        });
    } else if ("Notification" in window && Notification.permission === "granted") {
        scheduleDailyLoggingReminder();
    }
}

function scheduleDailyLoggingReminder() {
    setTimeout(() => {
        if (appState.todayLogs.length === 0) {
            new Notification("FitmakByTerTer", {
                body: "อย่าลืมบันทึกอาหารและการออกกำลังกายวันนี้!",
                icon: "https://cdn-icons-png.flaticon.com/512/709/709612.png"
            });
        }
    }, 1000 * 60 * 60 * 4);
}
