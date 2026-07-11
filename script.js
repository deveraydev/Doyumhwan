const DOYUM_RESPAWN = 30 * 60 * 1000; // Doyumwhan için 30 Dakika
const SOHAN_RESPAWN = 30 * 60 * 1000; // Sohan Dağı için 30 Dakika

let currentMap = ''; // 'doyum' veya 'sohan'
let currentCH = 1;
let isAudioOpen = true;
let wakeLock = null;

// Yapılandırma Şablonları
const mapStructures = {
    doyum: {
        title: "🔥 Doyumwhan Timers",
        zones: [
            { id: 'isinlayici', name: '1 - Işınlayıcı', slots: [{ id: '1', name: 'Metin A' }, { id: '2', name: 'Metin B' }] },
            { id: 'orta', name: '2 - Orta', slots: [{ id: '1', name: 'Metin A' }, { id: '2', name: 'Metin B' }] },
            { id: 'son', name: '3 - Son', slots: [{ id: '1', name: 'Metin A' }, { id: '2', name: 'Metin B' }] }
        ],
        respawn: DOYUM_RESPAWN
    },
    sohan: {
        title: "❄️ Sohan Dağı Timers",
        zones: [
            { id: 'kirmizigiris', name: 'Kırmızı Giriş', slots: [{ id: 'seytan', name: 'Şeytan M.' }, { id: 'olum', name: 'Ölüm M.' }] }
        ],
        respawn: SOHAN_RESPAWN
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // Sayfa yüklendiğinde hafızayı hazırla
    initStorage();
    // Ana zamanlayıcı döngüsünü başlat
    setInterval(tick, 1000);
});

// Karşılama Ekranını Kapatıp Harita Seçimini Açma
function dismissWelcome() {
    document.getElementById("welcome-overlay").classList.add("hidden");
    document.getElementById("map-selector-screen").classList.remove("hidden");
}

// Harita Seçildiğinde Tetiklenen Yapı
function selectMap(mapType) {
    currentMap = mapType;
    document.getElementById("map-selector-screen").classList.add("hidden");
    document.getElementById("main-app-screen").classList.remove("hidden");
    
    // Temaları ve Başlıkları Ayarla
    document.body.className = "metin2-core theme-" + mapType;
    document.getElementById("current-map-title").textContent = mapStructures[mapType].title;
    
    // Arayüzü İnşa Et
    buildTimersUI();
    switchCH(1);
}

// Harita Seçimine Geri Dönme
function goBackToMaps() {
    document.getElementById("main-app-screen").classList.add("hidden");
    document.getElementById("map-selector-screen").classList.remove("hidden");
    document.body.className = "metin2-core";
}

// Hafızada eksik kanal/bölge alanı kalmamasını sağlayan yapı
function initStorage() {
    ['doyum', 'sohan'].forEach(map => {
        const structure = mapStructures[map];
        for (let ch = 1; ch <= 6; ch++) {
            structure.zones.forEach(zone => {
                zone.slots.forEach(slot => {
                    const key = `${map}_ch${ch}_${zone.id}_${slot.id}`;
                    if (!localStorage.getItem(key)) {
                        localStorage.setItem(key, "0");
                    }
                });
            });
        }
    });
}

// Aktif Kanala Göre Arayüzdeki HTML Elemanlarını Basma
function buildTimersUI() {
    const container = document.getElementById("timers-container");
    container.innerHTML = ""; // İçeriği temizle
    
    const structure = mapStructures[currentMap];
    
    structure.zones.forEach(zone => {
        const zoneCard = document.createElement("div");
        zoneCard.className = "zone-card";
        zoneCard.id = `card-${zone.id}`;
        
        let slotsHtml = '';
        zone.slots.forEach(slot => {
            slotsHtml += `
                <div class="slot-row" id="slotrow-${zone.id}-${slot.id}">
                    <span class="slot-name">${slot.name}</span>
                    <span class="slot-timer" id="timer-${zone.id}-${slot.id}">30:00</span>
                    <div class="slot-adjusters">
                        <button onclick="adjustSlotTime('${zone.id}', '${slot.id}', -30)">-30s</button>
                        <button onclick="adjustSlotTime('${zone.id}', '${slot.id}', 30)">+30s</button>
                    </div>
                    <button class="slot-cut-btn" onclick="cutSlotMetin('${zone.id}', '${slot.id}')">KESTİM</button>
                </div>
            `;
        });
        
        zoneCard.innerHTML = `
            <div class="zone-title">${zone.name}</div>
            <div class="slots-grid">${slotsHtml}</div>
        `;
        
        container.appendChild(zoneCard);
    });
}

// Kanal Değiştirme Fonksiyonu
function switchCH(chNum) {
    currentCH = chNum;
    document.querySelectorAll(".ch-btn").forEach((btn, index) => {
        if (index === chNum - 1) btn.classList.add("active");
        else btn.classList.remove("active");
    });
    updateActiveTimersDisplay();
}

// Metin Kestim Buton Tetikleyicisi
function cutSlotMetin(zoneId, slotId) {
    const respawnDuration = mapStructures[currentMap].respawn;
    const targetTime = Date.now() + respawnDuration;
    localStorage.setItem(`${currentMap}_ch${currentCH}_${zoneId}_${slotId}`, targetTime);
    updateActiveTimersDisplay();
    renderDashboard();
}

// Süreyi Esnetme Buton Tetikleyicisi (+/- 30 saniye)
function adjustSlotTime(zoneId, slotId, seconds) {
    const key = `${currentMap}_ch${currentCH}_${zoneId}_${slotId}`;
    let targetTime = parseInt(localStorage.getItem(key)) || 0;
    
    if (targetTime > Date.now()) {
        targetTime += (seconds * 1000);
        localStorage.setItem(key, targetTime);
        updateActiveTimersDisplay();
        renderDashboard();
    }
}

// Saniyede bir çalışan ana motor
function tick() {
    if (!currentMap) return;
    updateActiveTimersDisplay();
    renderDashboard();
    checkGlobalAlerts();
}

// Aktif Ekrandaki Sayaçları Güncel Tutma
function updateActiveTimersDisplay() {
    const now = Date.now();
    const structure = mapStructures[currentMap];
    
    structure.zones.forEach(zone => {
        zone.slots.forEach(slot => {
            const key = `${currentMap}_ch${currentCH}_${zone.id}_${slot.id}`;
            const targetTime = parseInt(localStorage.getItem(key)) || 0;
            const remaining = targetTime - now;
            
            const slotElement = document.getElementById(`slotrow-${zone.id}-${slot.id}`);
            const timerText = document.getElementById(`timer-${zone.id}-${slot.id}`);
            
            if (!slotElement || !timerText) return;
            
            if (remaining > 0) {
                slotElement.className = "slot-row cooldown";
                const mins = Math.floor(remaining / 60000);
                const secs = Math.floor((remaining % 60000) / 1000);
                timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            } else {
                slotElement.className = "slot-row ready";
                timerText.textContent = "00:00";
            }
        });
    });
}

// GENEL DURUM PANAROMASI (DASHBOARD GENERATOR)
function renderDashboard() {
    const dashGrid = document.getElementById("dashboard-grid");
    if (!dashGrid || !currentMap) return;
    
    const now = Date.now();
    const structure = mapStructures[currentMap];
    let html = '';
    
    for (let ch = 1; ch <= 6; ch++) {
        let badgesHtml = '';
        
        structure.zones.forEach(zone => {
            zone.slots.forEach(slot => {
                const key = `${currentMap}_ch${ch}_${zone.id}_${slot.id}`;
                const targetTime = parseInt(localStorage.getItem(key)) || 0;
                const remaining = targetTime - now;
                
                // Kısa isim formatı
                let shortZoneName = zone.id === 'kirmizigiris' ? '' : (zone.id === 'isinlayici' ? 'Işın' : zone.id === 'orta' ? 'Orta' : 'Son');
                let displayName = `${shortZoneName} ${slot.name.replace('Metin ', '')}`;
                if(currentMap === 'sohan') displayName = slot.name; // Şeytan M. veya Ölüm M.
                
                if (remaining > 0) {
                    const mins = Math.floor(remaining / 60000);
                    const secs = Math.floor((remaining % 60000) / 1000);
                    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                    badgesHtml += `<span class="dash-badge cooldown">${displayName}: ${timeStr}</span>`;
                } else {
                    badgesHtml += `<span class="dash-badge ready">${displayName}: HAZIR</span>`;
                }
            });
        });
        
        html += `
            <div class="dash-row">
                <div class="dash-ch-label">CH ${ch}</div>
                <div class="dash-dots-container">${badgesHtml}</div>
            </div>
        `;
    }
    
    dashGrid.innerHTML = html;
}

// Tüm Kanalları Tarayıp Alarm Zamanı Gelenleri Yakalama
function checkGlobalAlerts() {
    const now = Date.now();
    const structure = mapStructures[currentMap];
    
    for (let ch = 1; ch <= 6; ch++) {
        structure.zones.forEach(zone => {
            zone.slots.forEach(slot => {
                const key = `${currentMap}_ch${ch}_${zone.id}_${slot.id}`;
                const targetTime = parseInt(localStorage.getItem(key)) || 0;
                
                if (targetTime > 0 && now >= targetTime) {
                    localStorage.setItem(key, "0"); // Çift alarm çalmasını engellemek için sıfırla
                    triggerAlert(ch, zone.name, slot.name);
                }
            });
        });
    }
}

// Bildirim ve Ses Tetikleyicisi
function triggerAlert(ch, zoneName, slotName) {
    const mapLabel = currentMap === 'doyum' ? 'Doyumwhan' : 'Sohan Dağı';
    const msg = `${mapLabel} CH${ch} - ${zoneName} (${slotName}) Hazır!`;
    
    if (isAudioOpen) {
        playM2Beep();
    }
    
    if (Notification.permission === "granted") {
        new Notification("Metin Hazır!", { body: msg });
    }
}

// Bip Sesi Üretici
function playM2Beep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        [0, 180, 360].forEach(delay => {
            setTimeout(() => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(950, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.12);
            }, delay);
        });
    } catch (e) { console.log(e); }
}

// WAKE LOCK API ENTEGRASYONU (Ekranın Kapanmasını Engelleme)
async function toggleWakeLock() {
    const btn = document.getElementById("btn-wakelock");
    if (!wakeLock) {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                btn.textContent = "👁️ Ekran Uyanık";
                btn.classList.add("active-lock");
                
                wakeLock.addEventListener('release', () => {
                    wakeLock = null;
                    btn.textContent = "👁️ Ekranı Uyanık Tut";
                    btn.classList.remove("active-lock");
                });
            } else {
                alert("Wake Lock özelliği bu tarayıcıda desteklenmiyor.");
            }
        } catch (err) {
            console.error(err);
        }
    } else {
        wakeLock.release();
        wakeLock = null;
    }
}

// Yardımcı Kontrol Fonksiyonları (Ses & İzin)
function toggleAudio() {
    isAudioOpen = !isAudioOpen;
    document.getElementById("btn-audio").textContent = isAudioOpen ? "🔊 Ses Açık" : "🔇 Ses Kapalı";
}

function requestNotificationPermission() {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            document.getElementById("btn-noti").textContent = "🔔 Aktif";
        
