// BÖLGE VE ÇİFT METİN AYARLI VERİ YAPISI
const mapData = {
    sohan: {
        label: "Sohan Dağı",
        cooldown: 45 * 60, // 45 Dakika
        slots: [
            { id: "kr_isinlayici_1", name: "Kırmızı B. Işınlayıcı - Metin 1" },
            { id: "kr_isinlayici_2", name: "Kırmızı B. Işınlayıcı - Metin 2" },
            { id: "orta_1", name: "Orta Bölge - Metin 1" },
            { id: "orta_2", name: "Orta Bölge - Metin 2" },
            { id: "sari_isinlayici_1", name: "Sarı B. Işınlayıcı - Metin 1" },
            { id: "sari_isinlayici_2", name: "Sarı B. Işınlayıcı - Metin 2" },
            { id: "portal_1", name: "Portal Bölgesi - Metin 1" },
            { id: "portal_2", name: "Portal Bölgesi - Metin 2" }
        ]
    },
    doyum: {
        label: "Doyumwhan",
        cooldown: 60 * 60, // 60 Dakika
        slots: [
            { id: "kr_isinlayici_1", name: "Kırmızı B. Işınlayıcı - Metin 1" },
            { id: "kr_isinlayici_2", name: "Kırmızı B. Işınlayıcı - Metin 2" },
            { id: "orta_1", name: "Orta Bölge - Metin 1" },
            { id: "orta_2", name: "Orta Bölge - Metin 2" },
            { id: "son_1", name: "Son Bölge - Metin 1" },
            { id: "son_2", name: "Son Bölge - Metin 2" }
        ]
    }
};

const CHANNELS = [1, 2, 3, 4];
let currentMap = "sohan";
let timers = {}; 
let isAudioOpen = true;
let wakeLock = null;

// DOM ELEMENTLERİ
const mapSelect = document.getElementById("map-select");
const audioToggle = document.getElementById("audio-toggle");
const wakeLockStatus = document.getElementById("wakelock-status");
const channelsContainer = document.getElementById("channels-container");
const generalDashboard = document.getElementById("general-dashboard");

// BAŞLANGIÇ TETİKLEMESİ
init();

function init() {
    setupEventListeners();
    requestNotificationPermission();
    loadTimers();
    renderUI();
    startGlobalClock();
    activateWakeLock();
}

function setupEventListeners() {
    mapSelect.addEventListener("change", (e) => {
        currentMap = e.target.value;
        renderUI();
    });

    audioToggle.addEventListener("change", (e) => {
        isAudioOpen = e.target.checked;
    });

    document.addEventListener("click", activateWakeLock);
}

// BROWSER PLAN BİLDİRİM İZNİ (Arka planda çalışması için kritik)
function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

// TÜRKÇE SESLİ KONUŞMA UYARISI (Web Speech API)
function playVoiceAlert() {
    if ('speechSynthesis' in window) {
        // Devam eden diğer konuşmalar varsa temizle (üst üste binmesin)
        window.speechSynthesis.cancel(); 
        
        const utterance = new SpeechSynthesisUtterance("Metin Süresi gelmiştir Kontrol Ediniz");
        utterance.lang = "tr-TR";
        utterance.rate = 1.0; // Konuşma hızı
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// ANDROID EKRAN KORUYUCU ENGELLEYİCİ
async function activateWakeLock() {
    if ('wakeLock' in navigator && wakeLock === null) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLockStatus.textContent = "🔓 Wake Lock: Aktif";
            wakeLockStatus.className = "status-badge status-on";
            
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
                wakeLockStatus.textContent = "🔒 Wake Lock: Pasif";
                wakeLockStatus.className = "status-badge status-off";
            });
        } catch (err) {
            console.log(`Wake Lock Devre Dışı: ${err.message}`);
        }
    }
}

function loadTimers() {
    const saved = localStorage.getItem("gomidas_kirbach_v2_timers");
    if (saved) {
        timers = JSON.parse(saved);
    }
}

function saveTimers() {
    localStorage.setItem("gomidas_kirbach_v2_timers", JSON.stringify(timers));
}

window.handleSlotClick = function(ch, slotId) {
    const timerKey = `${currentMap}_CH${ch}_${slotId}`;
    const now = Math.floor(Date.now() / 1000);
    const cdSeconds = mapData[currentMap].cooldown;

    if (!timers[timerKey] || now >= timers[timerKey].targetTime) {
        timers[timerKey] = {
            targetTime: now + cdSeconds,
            notified: false
        };
    } else {
        delete timers[timerKey];
    }

    saveTimers();
    renderUI();
};

function renderUI() {
    const currentMapInfo = mapData[currentMap];
    let channelsHtml = "";

    CHANNELS.forEach(ch => {
        let slotsHtml = "";
        currentMapInfo.slots.forEach(slot => {
            const timerKey = `${currentMap}_CH${ch}_${slot.id}`;
            const timerState = getTimerState(timerKey);

            slotsHtml += `
                <div class="slot-row">
                    <div class="slot-info">
                        <span class="slot-name">${slot.name}</span>
                        <span class="slot-timer ${timerState.isCounting ? 'counting' : ''}" id="time-${timerKey}">
                            ${timerState.text}
                        </span>
                    </div>
                    <button class="btn-kestim ${timerState.isCounting ? '' : 'waiting'}" onclick="handleSlotClick(${ch}, '${slot.id}')">
                        ${timerState.isCounting ? 'İptal Et' : 'Kestim'}
                    </button>
                </div>
            `;
        });

        channelsHtml += `
            <div class="ch-card">
                <h3>CH ${ch}</h3>
                <div class="slots-list">${slotsHtml}</div>
            </div>
        `;
    });
    channelsContainer.innerHTML = channelsHtml;
    renderDashboard();
}

function renderDashboard() {
    const currentMapInfo = mapData[currentMap];
    let dashHtml = "";

    CHANNELS.forEach(ch => {
        currentMapInfo.slots.forEach(slot => {
            const timerKey = `${currentMap}_CH${ch}_${slot.id}`;
            const timerState = getTimerState(timerKey);
            const isReady = !timerState.isCounting;

            // Dashboard'da isimlerin sığması için kısa gösterim
            const shortName = slot.name.replace(" - Metin", " M");

            dashHtml += `
                <div class="dash-item ${isReady ? 'ready' : ''}">
                    <span>CH${ch} - ${shortName}</span>
                    <strong>${timerState.text}</strong>
                </div>
            `;
        });
    });
    generalDashboard.innerHTML = dashHtml;
}

function getTimerState(timerKey) {
    const now = Math.floor(Date.now() / 1000);
    const timer = timers[timerKey];

    if (!timer || now >= timer.targetTime) {
        return { text: "HAZIR ⚔️", isCounting: false };
    }

    const remaining = timer.targetTime - now;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return { text: `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`, isCounting: true };
}

// ARKA PLAN VE SÜREKLİ TAKİP SAATİ
function startGlobalClock() {
    setInterval(() => {
        const now = Math.floor(Date.now() / 1000);

        for (const timerKey in timers) {
            const timer = timers[timerKey];
            if (now >= timer.targetTime && !timer.notified) {
                timer.notified = true;
                
                const parts = timerKey.split("_");
                const mapId = parts[0];
                const ch = parts[1].replace("CH", "");
                const slotId = parts.slice(2).join("_"); 

                const zoneLabel = mapData[mapId].slots.find(s => s.id === slotId)?.name || "Bilinmeyen Bölge";
                
                // Alarmı Tetikle
                triggerAlert(ch, zoneLabel, mapData[mapId].label);
            }
        }

        // DOM Süre Güncellemeleri
        const currentMapInfo = mapData[currentMap];
        CHANNELS.forEach(ch => {
            currentMapInfo.slots.forEach(slot => {
                const timerKey = `${currentMap}_CH${ch}_${slot.id}`;
                const timerElement = document.getElementById(`time-${timerKey}`);
                if (timerElement) {
                    const timerState = getTimerState(timerKey);
                    timerElement.textContent = timerState.text;
                    if (timerState.isCounting) {
                        timerElement.classList.add("counting");
                    } else {
                        timerElement.classList.remove("counting");
                    }
                }
            });
        });

        renderDashboard();
    }, 1000);
}

// BİLDİRİM VE SES YÖNETİMİ
function triggerAlert(ch, zoneName, mapLabel) {
    const msg = `${mapLabel} CH${ch} - ${zoneName} ZAMANI!`;
    
    // 1. Türkçe Sesli Konuşma Tetikleyici
    if (isAudioOpen) {
        playVoiceAlert();
    }
    
    // 2. Ön Plan Bildirimi (Açık Ekran)
    showOnScreenNotification(msg);
    
    // 3. ARKA PLAN BİLDİRİMİ (Site aşağı alındığında işletim sistemi seviyesinde fırlar)
    if (Notification.permission === "granted") {
        new Notification("⚔️ METİN SÜRESİ GELDİ!", {
            body: `${mapLabel} CH${ch} - ${zoneName} doğmuş olabilir, kontrol ediniz.`,
            tag: "m2-farm-alert", // Aynı bildirimlerin üst üste yığılmasını önler
            requireInteraction: true // Kullanıcı kapatana kadar ekranda kalır
        });
    }
}

function showOnScreenNotification(message) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    
    const toast = document.createElement("div");
    toast.className = "toast-alert";
    toast.innerHTML = `
        <span>⚔️ ${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 10000); // Ekran bildirimi 10 saniye kalır
}
