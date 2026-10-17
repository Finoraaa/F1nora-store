<p align="center">
  <img src="./public/logo.png" alt="Finora Wolf Logo" width="130" style="border-radius: 20px; box-shadow: 0 0 30px rgba(255,255,255,0.2);" />
</p>

<h1 align="center">🐺 Finora's Store</h1>

<p align="center">
  <strong>Tüm Platformlar İçin Açık Kaynak Uygulama Dağıtım Merkezi</strong><br>
  Finora projelerini ve açık kaynak uygulamaları resmi GitHub Releases üzerinden Windows, Android, Linux ve macOS için tek tıkla cihazınıza ulaştıran modern mağaza.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Android%20%7C%20Linux%20%7C%20macOS%20%7C%20iOS-white?style=flat-square" alt="Platforms" />
  <img src="https://img.shields.io/badge/Design-Monochrome%20Cyber--Stealth-111115?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Design" />
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white" alt="GitHub Actions" />
</p>

---

## ⚡ Özellikler

- **🎯 Akıllı İşletim Sistemi Tespiti:** Ziyaret ettiğiniz cihazın işletim sistemini (Windows, Android, Debian/Ubuntu, Arch, macOS, iOS) anında tespit eder ve en uygun indirme paketini (örn. Linux için `.deb`/`.AppImage`, Windows için `.exe`, Android için `.apk`) kartın en önünde vurgular.
- **🚀 Aracısız & Doğrudan İndirme:** Dosyaları 3. parti ara sunucular yerine doğrudan resmi GitHub Releases CDN bağlantılarından maksimum indirme hızıyla çeker.
- **🔍 Canlı GitHub Releases Entegrasyonu:**
  - Resmi GitHub REST API ile versiyon etiketlerini, yayınlanma tarihlerini, toplam indirme sayılarını ve dosya boyutlarını canlı kontrol eder.
  - Sürüm notlarını (Changelog) zengin Markdown biçiminde görüntüler.
- **➕ Özel GitHub Deposu Ekleme:** Mağazada olmayan herhangi bir açık kaynak GitHub deposunun linkini (`kullanıcı/depo`) yapıştırarak mağazanıza ekleyebilir, paketlerini anında görüntüleyebilirsiniz.
- **📥 İndirme Yöneticisi:** İndirdiğiniz paketleri yerel oturum geçmişinde tutar, tek tıkla tekrar indirmenize olanak tanır.
- **🎨 Siyah / Gri / Beyaz Tasarım:** Kurt logosuna özel, göz yormayan, cam efektli (glassmorphism), mikro animasyonlu ve yüksek kontrastlı monokrom karanlık tema.
- **⚙️ GitHub Token Desteği:** İsteğe bağlı olarak kendi GitHub Personal Access Token'ınızı ekleyerek saatlik 60 istek sınırını 5.000 isteğe çıkarabilirsiniz.

---

## 🖥️ Desteklenen Platformlar & Dosya Türleri

| Platform | Formatlar | Öncelikli Seçim |
| :--- | :--- | :--- |
| **🪟 Windows** | `.exe`, `.msi`, `.zip` | `x64 .exe` veya `.msi` |
| **🤖 Android** | `.apk`, `.aab` | Universal APK veya `arm64-v8a.apk` |
| **🐧 Debian / Ubuntu Linux** | `.deb`, `.AppImage`, `.tar.gz` | `amd64.deb` |
| **🐧 Evrensel Linux** | `.AppImage`, `.tar.xz`, `.rpm` | `x86_64.AppImage` |
| **🍎 macOS** | `.dmg`, `.pkg`, `.zip` | Apple Silicon / Intel `.dmg` |
| **📱 iOS** | `.ipa`, Web App (PWA) | `.ipa` / Web Kurulumu |

---

## 🛠️ Yerel Geliştirme (Local Development)

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Tarayıcınızda açın:
# http://localhost:5173
```

---

## 🚀 GitHub Actions ile Otomatik Derleme ve Yayınlama

Projede iki adet önceden yapılandırılmış GitHub Actions iş akışı yer almaktadır:

### 1. Canlı Web & GitHub Pages (`.github/workflows/deploy-pages.yml`)
`main` dalına her kod gönderildiğinde projeyi otomatik olarak derler ve **GitHub Pages** üzerine yükler. Böylece herhangi bir kurulum yapmadan tarayıcınızdan mağazaya erişebilirsiniz.

### 2. Masaüstü Derlemeleri (`.github/workflows/build-and-release.yml`)
Ubuntu, Windows ve macOS sunucularında matris derleme çalıştırır:
- **Linux:** `.deb` ve `.AppImage`
- **Windows:** `.exe` installer ve `.zip`
- **macOS:** `.dmg`

Tetiklemek için:
```bash
git tag v1.0.0
git push origin v1.0.0
```
veya GitHub üzerindeki **Actions** sekmesinden *"Run workflow"* butonuna basarak istediğiniz an manuel derleme başlatabilirsiniz.

---

## 📂 Proje Yapısı

```
f1nora-store/
├── .github/workflows/
│   ├── build-and-release.yml  # Çoklu platform GitHub Actions derleme
│   └── deploy-pages.yml       # GitHub Pages otomatik dağıtım
├── assets/
│   └── logo.png               # Finora Kurt Logosu
├── electron/
│   └── main.js                # Masaüstü pencere denetleyicisi
├── public/
│   ├── default-catalog.json   # Öntanımlı VPN, tarayıcı ve araçlar listesi
│   ├── manifest.json          # Android & iOS PWA manifesti
│   └── logo.png               # Web ikonu ve favicon
├── src/
│   ├── catalog.js             # Katalog ve yerel depo yöneticisi
│   ├── download-manager.js    # İndirme geçmişi ve tetikleyici
│   ├── github-api.js          # Canlı GitHub Releases motoru
│   ├── main.js                # Arayüz denetleyicisi ve olaylar
│   ├── os-detector.js         # İşletim sistemi ve paket ayrıştırıcı
│   └── style.css              # Siyah/Gri/Beyaz monokrom stil sistemi
├── index.html                 # Mağaza arayüzü ve modalları
├── package.json
└── vite.config.js
```

---

<p align="center">
  Made with 🐺 for the <strong>Finora Ecosystem</strong>.
</p>
