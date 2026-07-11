// HARİTA VE COOLDOWN VERİ YAPISI
const mapData = {
    sohan: {
        label: "Sohan Dağı",
        cooldown: 45 * 60, // 45 Dakika
        slots: [
            { id: "kr_giriş", name: "Kırmızı Giriş" },
            { id: "mavi_giriş", name: "Mavi Giriş" },
            { id: "orta_bölge", name: "Harita Ortası" }
        ]
    },
    doyum: {
        label: "Doyumwhan",
        cooldown: 60 * 60, // 60 Dakika
        slots: [
            { id: "orta_metin", name: "Çorak Orta" },
            { id: "sağ_bölge", name: "Işınlayıcı Çevresi" },
            { id: "sol_alt", name: "Kırmızı Ejderha Kalesi Önü" }
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

// BAŞLANGIÇ ÇALIŞTIRMASI
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

    // Kullanıcı ekrana dokunduğunda Wake Lock'u canlandır
    document.addEventListener("click", activateWakeLock);
}

// BROWSER BİLDİRİM İZNİ
function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

// SENTEZLENMİŞ METIN2 BEEP SESİ (Harici dosya gerektirmez)
function playM2Beep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // 1. Nota (Tiz)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 Notası
        gain1.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 0.15);

        // 2. Nota (Milisaniyeler sonra hafif pes)
        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(1200, audioCtx.currentTime);
            gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 0.2);
        }, 80);

    } catch (e) {
        console.log("Ses çalınamadı, etkileşim bekleniyor.");
    }
}

// ANDROID EKRAN KARARMA ENGELLEYİCİ (WAKE LOCK)
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
            console.log(`Wake Lock Hatası: ${err.message}`);
        }
    }
}

// LOCALSTORAGE YÜKLEME VE KAYDETME
function loadTimers() {
    const saved = localStorage.getItem("gomidas_kirbach_timers");
    if (saved) {
        timers = JSON.parse(saved);
    }
}

function saveTimers() {
    localStorage.setItem("gomidas_kirbach_timers", JSON.stringify(timers));
}

// KESTİM BUTONU TETİKLEYİCİSİ
window.handleSlotClick = function(ch, slotId) {
    const timerKey = `${currentMap}_CH${ch}_${slotId}`;
    const now = Math.floor(Date.now() / 1000);
    const cdSeconds = mapData[currentMap].cooldown;

    if (!timers[timerKey] || now >= timers[timerKey].targetTime) {
        // Geri sayım başlat
        timers[timerKey] = {
            targetTime: now + cdSeconds,
            notified: false
        };
    } else {
        // Süre bitmeden basılırsa sayacı sıfırla/iptal et
        delete timers[timerKey];
    }

    saveTimers();
    renderUI();
};

// ARAYÜZÜ ÇİZME (DYNAMIC RENDERING)
function renderUI() {
    const currentMapInfo = mapData[currentMap];
    
    // 1. CH Kartlarını Oluştur
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

    // 2. Genel Durum Panelini Güncelle
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

            dashHtml += `
                <div class="dash-item ${isReady ? 'ready' : ''}">
                    <span>CH${ch} - ${slot.name.substring(0,6)}..</span>
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
    const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    return { text: formattedTime, isCounting: true };
}

// GLOBAL DÖNGÜ (HER SANİYE ÇALIŞIR)
function startGlobalClock() {
    setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        let statusChanged = false;

        // Zamanlayıcıları kontrol et ve bitenleri tetikle
        for (const timerKey in timers) {
            const timer = timers[timerKey];
            if (now >= timer.targetTime && !timer.notified) {
                timer.notified = true;
                
                // Hangi harita, ch ve slot olduğunu key'den ayrıştırıyoruz
                const parts = timerKey.split("_");
                const mapId = parts[0];
                const ch = parts[1].replace("CH", "");
                // Slot id'si birden fazla alt tire içerebilir, kalan kısmı birleştiriyoruz
                const slotId = parts.slice(2).join("_"); 

                const zoneLabel = mapData[mapId].slots.find(s => s.id === slotId)?.name || "Bilinmeyen Bölge";
                
                triggerAlert(ch, zoneLabel, mapData[mapId].label);
                statusChanged = true;
            }
        }

        // Saniyede bir süreleri güncelle (Arayüze yansıt)
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

        // Her saniye dashboard'u da hafifçe tazele
        renderDashboard();

    }, 1000);
}

// BİLDİRİM VE UYARI TETİKLEYİCİSİ
function triggerAlert(ch, zoneName, mapLabel) {
    const msg = `${mapLabel} CH${ch} - ${zoneName} KESİLEBİLİR!`;
    
    // 1. Sesli Uyarı
    if (isAudioOpen) {
        playM2Beep();
    }
    
    // 2. EKRANDA GÖSTERİM (Yeni Eklenen Sistem)
    showOnScreenNotification(msg);
    
    // 3. Tarayıcı Arka Plan Bildirimi (Açıksa)
    if (Notification.permission === "granted") {
        new Notification("Metin Hazır!", { body: msg });
    }
}

// TOAST ALERT OLUŞTURUCU
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
    
    // 8 saniye sonra ekrandan otomatik silinir
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 8000);
        }
