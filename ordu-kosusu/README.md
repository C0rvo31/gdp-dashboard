# Ordu Koşusu

Telefon için 3D koşu oyunu: düz yolda askerlerini topla, kapılardan geç (+, ×, −, ÷),
silah sandıklarını vurup silahını güçlendir, düşman gruplarını ve testereleri atlat,
yolun sonunda devi yen. Kazandığın altınlarla asker sayısı, ateş hızı ve güç yükselt.

**Kurulum:** `OrduKosusu.apk` dosyasını telefona indirip aç ("bilinmeyen kaynaklara izin ver"
sorulursa izin ver). Android 7.0 ve üzeri.

## Kontroller
Ekranda parmağını sağa-sola kaydır. Ayarlar (⚙) menüsünde ses, titreşim ve **Pil Tasarrufu**
(30 FPS + düşük çözünürlük) var.

## Teknik
- Oyun: Three.js (WebGL), tek HTML dosyası, internet gerekmez (`web/src`).
- Pil dostu: tüm askerler instanced mesh (birkaç draw call), gölge haritası yok, 60 FPS sınırı,
  menüde 30 FPS, uygulama arka plandayken çizim durur.
- APK, Android SDK olmadan derlenir: `./build.sh` (JDK 17+, Node 18+, Python 3).
  Manifest/kaynak tablosu `android/apkpack.py` ile yazılır, `dx` ile dex'lenir, `apksig` ile v2 imzalanır.
- İmza anahtarı (`android/release.p12`) repoya konmaz; yeni anahtarla derlenen sürümü kurmadan önce
  eskisini kaldırmak gerekir.
