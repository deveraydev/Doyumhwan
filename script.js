const RESPAWN_TIME = 15 * 60 * 1000; // 15 Dakika (milisaniye)
let currentCH = 1;
let isAudioOpen = true;

// Sayfa ilk yüklendiğinde çalışacak fonksiyonlar
document.addEventListener("DOMContentLoaded", () => {
    initTimers();
    // Her saniye ekranı güncellemek için ana döngü
    setInterval(updateUI, 1000);
});

// Tarayıcı hafızasını kontrol et, eksik veri varsa boş şablon yarat
function initTimers() {
    for (let ch = 1; ch <= 6; ch++) {
        ['isinlayici', 'orta', 'son'].forEach(zone => {
            const key = `ch${ch}_${zone}`;
            if (!localStorage.getItem(key)) {
                localStorage.setItem(key, "0"); // 0 demek süresi bitmiş, hazır demek
            }
        });
    }
    updateUI();
}

// Kanal Değiştirme Fonksiyonu
function switchCH(chNum) {
    currentCH = chNum;
    document.querySelectorAll(".ch-btn").forEach((btn, index) => {
        if (index === chNum - 1) btn.classList.add("active");
        else btn.classList.remove("active");
    });
    updateUI();
}

// Metin Kesildiğinde Tetiklenen Fonksiyon
function cutMetin(zone) {
    const targetTime = Date.now() + RESPAWN_TIME;
    localStorage.setItem(`ch${currentCH}_${zone}`, targetTime);
    updateUI();
}

// Esneklik Özelliği: Süreyi İleri/Geri Alma (+/- 30 saniye)
function adjustTime(zone, seconds) {
    const key = `ch${currentCH}_${zone}`;
    let targetTime = parseInt(localStorage.getItem(key)) || 0;
    
    // Eğer halihazırda aktif bir geri sayım varsa süreyi manipüle et
    if (targetTime > Date.now()) {
        targetTime += (seconds * 1000);
        localStorage.setItem(key, targetTime);
        updateUI();
    }
}

// Ekranı ve Kart Durumlarını Saniyede Bir Güncelleyen Motor
function updateUI() {
    const now = Date.now();
    const zones = ['isinlayici', 'orta', 'son'];

    zones.forEach(zone => {
        const key = `ch${currentCH}_${zone}`;
        const targetTime = parseInt(localStorage.getItem(key)) || 0;
        const remaining = targetTime - now;

        const card = document.getElementById(`zone-${zone}`);
        const timerText = card.querySelector(".timer-display");
        const indicator = card.querySelector(".status-indicator");

        if (remaining > 0) {
            // Metin kesilmiş, geri sayım devam ediyor (KIRMIZI DURUM)
            card.classList.remove("ready");
            card.classList.add("cooldown");
            indicator.className = "status-indicator bg-red";
            
            // Dakika:Saniye formatlama
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            // Metin çıktı! (YEŞİL DURUM)
            card.classList.remove("cooldown");
            card.classList.add("ready");
            indicator.className = "status-indicator bg-green";
            timerText.textContent = "00:00";
        }
    });

    // Arka plandaki tüm kanalları kontrol et (Süresi dolan varsa alarm çalması için)
    checkAllChannelsForAlert(now);
}

// Aktif kanal fark etmeksizin süresi dolan metinleri yakalayan sistem
function checkAllChannelsForAlert(now) {
    for (let ch = 1; ch <= 6; ch++) {
        ['isinlayici', 'orta', 'son'].forEach(zone => {
            const key = `ch${ch}_${zone}`;
            const targetTime = parseInt(localStorage.getItem(key)) || 0;
            
            // Süre tam bu saniyede sıfırın altına düştüyse tetikle
            if (targetTime > 0 && now >= targetTime) {
                localStorage.setItem(key, "0"); // Alarmın tekrar tekrar çalan döngüye girmemesi için sıfırla
                triggerAlert(ch, zone);
            }
        });
    }
}

// Uyarı Tetikleyicisi (Ses + Tarayıcı Bildirimi)
function triggerAlert(ch, zone) {
    let zoneNameStr = zone === 'isinlayici' ? 'Işınlayıcı' : zone === 'orta' ? 'Orta' : 'Son';
    const message = `CH ${ch} - ${zoneNameStr} Metni Çıktı!`;

    // 1. Ses Çal (Web Audio API ile harici dosyasız bip sesi)
    if (isAudioOpen) {
        playBeep();
    }

    // 2. Tarayıcı Bildirimi Gönder
    if (Notification.permission === "granted") {
        new Notification("Metin2 Mobile Sayaç", {
            body: message,
            icon: "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?w=100" // Geçici ikon
        });
    }
}

// Dışarıdan dosya yüklemeden saf kodla bip sesi üretme fonksiyonu
function playBeep() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // İki seri bip sesi çıkarır
        [0, 200].forEach(delay => {
            setTimeout(() => {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // Ses inceliği (A5 notası)
                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime); // Ses seviyesi
                
                oscillator.start();
                oscillator.stop(audioCtx.currentTime + 0.15); // 0.15 saniye çalar
            }, delay);
        });
    } catch (e) {
        console.log("Ses çalınamadı (Tarayıcı etkileşim kısıtlaması).");
    }
}

// Ses Kontrol Butonu
function toggleAudio() {
    isAudioOpen = !isAudioOpen;
    document.getElementById("btn-audio").textContent = isAudioOpen ? "🔊 Ses Açık" : "🔇 Ses Kapalı";
}

// Bildirim İzin İsteme Mekanizması
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        alert("Bu tarayıcı masaüstü bildirimlerini desteklemiyor.");
        return;
    }
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            alert("Bildirim izni verildi! Süre bittiğinde bildirim alacaksın.");
            document.getElementById("btn-noti").textContent = "🔔 İzin Verildi";
        }
    });
}

