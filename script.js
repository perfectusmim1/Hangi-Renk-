// API anahtarı ve yapılandırma
const GEMINI_API_KEY = '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// DOM elementleri
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const clearBtn = document.getElementById('clearBtn');
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const resultBadge = document.getElementById('resultBadge');
const resultDetails = document.getElementById('resultDetails');
const confidenceFill = document.getElementById('confidenceFill');
const confidenceValue = document.getElementById('confidenceValue');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');

let currentImageData = null;

// Event listeners
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
analyzeBtn.addEventListener('click', analyzeImage);
clearBtn.addEventListener('click', clearImage);
retryBtn.addEventListener('click', analyzeImage);

// Drag & Drop işlemleri
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// Dosya işleme
function handleFile(file) {
    // Dosya türü kontrolü
    if (!file.type.startsWith('image/')) {
        showError('Lütfen geçerli bir görsel dosyası seçin.');
        return;
    }

    // Dosya boyutu kontrolü (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        showError('Dosya boyutu 5MB\'dan küçük olmalıdır.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        currentImageData = e.target.result.split(',')[1]; // Base64 data
        showPreview();
    };
    reader.readAsDataURL(file);
}

function showPreview() {
    hideAllSections();
    previewSection.style.display = 'block';
    previewSection.classList.add('fade-in');
}

function clearImage() {
    currentImageData = null;
    fileInput.value = '';
    hideAllSections();
    uploadArea.style.display = 'block';
}

function hideAllSections() {
    const sections = [previewSection, loadingSection, resultSection, errorSection];
    sections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('fade-in', 'scale-in');
    });
}

function showLoading() {
    hideAllSections();
    loadingSection.style.display = 'block';
    loadingSection.classList.add('fade-in');
}

function showError(message) {
    hideAllSections();
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    errorSection.classList.add('fade-in');
}

// Görsel analizi
async function analyzeImage() {
    if (!currentImageData) {
        showError('Önce bir görsel yükleyin.');
        return;
    }

    showLoading();

    try {
        const analysisPrompt = `
Bu görseli analiz et ve aşağıdaki kriterlere göre "PEMBE" veya "KARA" olarak kategorize et:

ANALİZ KRİTERLERİ:
1. Ten rengini değerlendir (açık/koyu)
2. Eğer ten açık renkliyse:
   - Genel vücut yapısına bak
   - Saç rengini kontrol et (açık/koyu)
   - Deri durumunu incele (temiz/buruşuk)
   - Tüm özellikler açık renk ve deri temizse → PEMBE
   - Buruşuk deri varsa → KARA
3. Eğer ten koyu renkliyse → KARA

CEVAP FORMATI:
{
  "kategori": "PEMBE" veya "KARA",
  "guven_skoru": 1-100 arası sayı,
  "analiz_detaylari": {
    "ten_rengi": "açık/koyu",
    "sac_rengi": "açık/koyu/yok",
    "deri_durumu": "temiz/buruşuk/belirsiz",
    "vucut_yapisi": "genel gözlem"
  },
  "aciklama": "Kararın gerekçesi"
}

Sadece JSON formatında cevap ver, başka açıklama ekleme.
        `;

        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: analysisPrompt
                    },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: currentImageData
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1000
            }
        };

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API hatası: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('API\'den geçerli yanıt alınamadı.');
        }

        const resultText = data.candidates[0].content.parts[0].text;
        console.log('API Yanıtı:', resultText);

        // JSON yanıtını parse et
        let analysisResult;
        try {
            // JSON'u temizle ve parse et
            const cleanedJson = resultText.replace(/```json\n?|\n?```/g, '').trim();
            analysisResult = JSON.parse(cleanedJson);
        } catch (parseError) {
            console.error('JSON parse hatası:', parseError);
            throw new Error('Analiz sonucu işlenirken hata oluştu.');
        }

        showResult(analysisResult);

    } catch (error) {
        console.error('Analiz hatası:', error);
        showError(`Analiz sırasında hata oluştu: ${error.message}`);
    }
}

function showResult(result) {
    hideAllSections();
    
    // Kategori badge'ini ayarla
    const kategori = result.kategori.toUpperCase();
    resultBadge.textContent = kategori === 'PEMBE' ? '🌸 PEMBE' : '⚫ KARA';
    resultBadge.className = `result-badge ${kategori.toLowerCase()}`;
    
    // Detayları hazırla
    const detaylar = result.analiz_detaylari;
    const detayHTML = `
        <h4>📋 Analiz Detayları:</h4>
        <ul style="list-style: none; padding: 0;">
            <li><strong>👤 Ten Rengi:</strong> ${detaylar.ten_rengi}</li>
            <li><strong>💇 Saç Rengi:</strong> ${detaylar.sac_rengi}</li>
            <li><strong>🔍 Deri Durumu:</strong> ${detaylar.deri_durumu}</li>
            <li><strong>🏗️ Vücut Yapısı:</strong> ${detaylar.vucut_yapisi}</li>
        </ul>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
        <h4>💭 Karar Gerekçesi:</h4>
        <p>${result.aciklama}</p>
    `;
    
    resultDetails.innerHTML = detayHTML;
    
    // Güven skorunu ayarla
    const guvenSkoru = Math.max(0, Math.min(100, result.guven_skoru));
    confidenceFill.style.width = `${guvenSkoru}%`;
    confidenceValue.textContent = `%${guvenSkoru}`;
    
    // Sonuç bölümünü göster
    resultSection.style.display = 'block';
    resultSection.classList.add('scale-in');
    
    // Sonuç rengine göre güven çubuğu rengini değiştir
    if (kategori === 'PEMBE') {
        confidenceFill.style.background = 'linear-gradient(90deg, #ff9a9e, #fecfef)';
    } else {
        confidenceFill.style.background = 'linear-gradient(90deg, #434343, #000000)';
    }
}

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    console.log('Görsel Analiz Sistemi başlatıldı');
    
    // API anahtarı kontrolü
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_API_KEY')) {
        showError('API anahtarı yapılandırılmamış. Lütfen geliştirici ile iletişime geçin.');
    }
});

// Hata durumunda detaylı bilgi
window.addEventListener('error', function(e) {
    console.error('Genel hata:', e.error);
    if (loadingSection.style.display === 'block') {
        showError('Beklenmeyen bir hata oluştu. Lütfen sayfayı yenileyin.');
    }
});

// Network hatalarını yakala
window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise hatası:', e.reason);
    if (loadingSection.style.display === 'block') {
        showError('Bağlantı hatası. İnternet bağlantınızı kontrol edin.');
    }
});

