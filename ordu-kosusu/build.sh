#!/usr/bin/env bash
# Builds OrduKosusu.apk without the Android SDK (only JDK + Node + Python needed).
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$PWD; T=$ROOT/tools; B=$ROOT/build
M=https://repo1.maven.org/maven2
mkdir -p "$T" "$B"
[ -f "$T/android-4.1.1.4.jar" ] || curl -sSfL -o "$T/android-4.1.1.4.jar" $M/com/google/android/android/4.1.1.4/android-4.1.1.4.jar
[ -f "$T/dalvik-dx-16.0.1.jar" ] || curl -sSfL -o "$T/dalvik-dx-16.0.1.jar" $M/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar
[ -f "$T/apksig-2.3.0.jar" ] || curl -sSfL -o "$T/apksig-2.3.0.jar" $M/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar

echo "== web bundle"
(cd web && { [ -d node_modules ] || npm ci --silent; } && node build.mjs)
rm -rf "$B/assets" && mkdir -p "$B/assets" && cp web/dist/index.html "$B/assets/"

echo "== java -> dex"
rm -rf "$B/classes" && mkdir -p "$B/classes"
javac -nowarn --release 8 -cp "$T/android-4.1.1.4.jar" -d "$B/classes" $(find android/src -name '*.java')
java -cp "$T/dalvik-dx-16.0.1.jar" com.android.dx.command.Main --dex --min-sdk-version=24 --output="$B/classes.dex" "$B/classes"

echo "== pack"
python3 android/apkpack.py "$B/unsigned.apk" "$B/classes.dex" android/ic_launcher.png "$B/assets"

echo "== sign"
KS=android/release.p12
if [ ! -f "$KS" ]; then
  keytool -genkeypair -storetype PKCS12 -keystore "$KS" -storepass orduKosusu -keypass orduKosusu -alias ordu \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Ordu Kosusu" >/dev/null 2>&1
fi
rm -rf "$B/signer" && mkdir -p "$B/signer"
javac -nowarn -cp "$T/apksig-2.3.0.jar" -d "$B/signer" android/signer/Sign.java
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$T/apksig-2.3.0.jar:$B/signer" Sign "$KS" orduKosusu ordu "$B/unsigned.apk" "$ROOT/OrduKosusu.apk"
ls -la "$ROOT/OrduKosusu.apk"
