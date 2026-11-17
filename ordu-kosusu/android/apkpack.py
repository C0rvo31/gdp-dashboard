#!/usr/bin/env python3
"""Minimal APK packer: writes a binary AndroidManifest.xml (AXML) and a
resources.arsc holding one launcher icon, then zips them with classes.dex
and the game assets. The output is unsigned; sign it with apksig afterwards.

usage: apkpack.py OUT.apk CLASSES.dex ICON.png ASSET_DIR
"""
import struct
import sys
import zipfile
import os

PKG = "com.ordukosusu.game"
LABEL = "Ordu Koşusu"
VERSION_CODE = 4
VERSION_NAME = "1.3"
MIN_SDK = 24
TARGET_SDK = 34
ICON_PATH = "res/drawable-xxxhdpi-v4/ic_launcher.png"
ICON_ID = 0x7F010000

ANDROID_NS = "http://schemas.android.com/apk/res/android"
ATTR = {  # android.R.attr ids
    "theme": 0x01010000, "label": 0x01010001, "icon": 0x01010002, "name": 0x01010003,
    "exported": 0x01010010, "launchMode": 0x0101001D, "screenOrientation": 0x0101001E,
    "configChanges": 0x0101001F, "minSdkVersion": 0x0101020C, "versionCode": 0x0101021B,
    "versionName": 0x0101021C, "targetSdkVersion": 0x01010270, "allowBackup": 0x01010280,
    "hardwareAccelerated": 0x010102D3,
}
THEME_FULLSCREEN = 0x01030007  # @android:style/Theme.NoTitleBar.Fullscreen

T_REF, T_STRING, T_INT_DEC, T_INT_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


def pad4(b):
    return b + b"\0" * (-len(b) % 4)


def string_pool(strings):
    """UTF-16 string pool chunk."""
    offsets, data = [], b""
    for s in strings:
        offsets.append(len(data))
        u = s.encode("utf-16-le")
        n = len(u) // 2
        assert n < 0x8000
        data += struct.pack("<H", n) + u + b"\0\0"
    data = pad4(data)
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    size = strings_start + len(data)
    return (struct.pack("<HHIIIIII", 0x0001, header_size, size, len(strings), 0, 0, strings_start, 0)
            + b"".join(struct.pack("<I", o) for o in offsets) + data)


class Axml:
    """Tiny binary XML writer."""

    def __init__(self):
        self.attr_names = []   # resource-mapped attribute names (must come first in the pool)
        self.strings = []
        self.events = []

    def s(self, v):
        if v not in self.strings:
            self.strings.append(v)
        return v

    def start(self, tag, attrs):
        # attrs: list of (name, kind, value); kind in str/int/hex/bool/ref; ns android unless name == "package"
        for name, _, _ in attrs:
            if name in ATTR and name not in self.attr_names:
                self.attr_names.append(name)
        self.events.append(("start", tag, attrs))

    def end(self, tag):
        self.events.append(("end", tag, None))

    def build(self):
        # order pool: mapped attribute names first (in id order), then everything else
        self.attr_names.sort(key=lambda n: ATTR[n])
        pool = list(self.attr_names)

        def idx(v):
            if v not in pool:
                pool.append(v)
            return pool.index(v)

        idx("android"); idx(ANDROID_NS)
        for ev, tag, attrs in self.events:
            idx(tag)
            if attrs:
                for name, kind, val in attrs:
                    idx(name)
                    if kind == "str":
                        idx(val)

        body = b""
        line = 1
        body += struct.pack("<HHIIIII", 0x0100, 16, 24, line, 0xFFFFFFFF, idx("android"), idx(ANDROID_NS))
        ns = idx(ANDROID_NS)
        for ev, tag, attrs in self.events:
            line += 1
            if ev == "start":
                recs = []
                for name, kind, val in attrs:
                    ans = 0xFFFFFFFF if name == "package" else ns
                    raw = 0xFFFFFFFF
                    if kind == "str":
                        dtype, data = T_STRING, idx(val)
                        raw = data
                    elif kind == "int":
                        dtype, data = T_INT_DEC, val
                    elif kind == "hex":
                        dtype, data = T_INT_HEX, val
                    elif kind == "bool":
                        dtype, data = T_BOOL, 0xFFFFFFFF if val else 0
                    elif kind == "ref":
                        dtype, data = T_REF, val
                    else:
                        raise ValueError(kind)
                    recs.append((ATTR.get(name, 0xFFFFFFFF), struct.pack("<IIIHBBI", ans, idx(name), raw, 8, 0, dtype, data)))
                recs.sort(key=lambda r: r[0])
                ext = struct.pack("<IIHHHHHH", 0xFFFFFFFF, idx(tag), 20, 20, len(recs), 0, 0, 0)
                payload = ext + b"".join(r[1] for r in recs)
                body += struct.pack("<HHIII", 0x0102, 16, 16 + len(payload), line, 0xFFFFFFFF) + payload
            else:
                body += struct.pack("<HHIIIII", 0x0103, 16, 24, line, 0xFFFFFFFF, 0xFFFFFFFF, idx(tag))
        body += struct.pack("<HHIIIII", 0x0101, 16, 24, line + 1, 0xFFFFFFFF, idx("android"), ns)

        sp = string_pool(pool)
        resmap = struct.pack("<HHI", 0x0180, 8, 8 + 4 * len(self.attr_names)) + b"".join(
            struct.pack("<I", ATTR[n]) for n in self.attr_names)
        content = sp + resmap + body
        return struct.pack("<HHI", 0x0003, 8, 8 + len(content)) + content


def manifest():
    x = Axml()
    x.start("manifest", [
        ("versionCode", "int", VERSION_CODE),
        ("versionName", "str", VERSION_NAME),
        ("package", "str", PKG),
    ])
    x.start("uses-sdk", [("minSdkVersion", "int", MIN_SDK), ("targetSdkVersion", "int", TARGET_SDK)])
    x.end("uses-sdk")
    x.start("uses-permission", [("name", "str", "android.permission.VIBRATE")])
    x.end("uses-permission")
    x.start("uses-feature", [("name", "str", "android.hardware.touchscreen")])
    x.end("uses-feature")
    x.start("application", [
        ("label", "str", LABEL),
        ("icon", "ref", ICON_ID),
        ("allowBackup", "bool", True),
        ("hardwareAccelerated", "bool", True),
    ])
    x.start("activity", [
        ("name", "str", PKG + ".MainActivity"),
        ("label", "str", LABEL),
        ("theme", "ref", THEME_FULLSCREEN),
        ("screenOrientation", "int", 1),        # portrait
        ("configChanges", "hex", 0x0FB0),       # orientation|keyboardHidden|screenSize|screenLayout|smallestScreenSize|uiMode|keyboard...
        ("launchMode", "int", 2),               # singleTask
        ("exported", "bool", True),
        ("hardwareAccelerated", "bool", True),
    ])
    x.start("intent-filter", [])
    x.start("action", [("name", "str", "android.intent.action.MAIN")])
    x.end("action")
    x.start("category", [("name", "str", "android.intent.category.LAUNCHER")])
    x.end("category")
    x.end("intent-filter")
    x.end("activity")
    x.end("application")
    x.end("manifest")
    return x.build()


def resources_arsc():
    """resources.arsc with a single drawable (the icon) at xxxhdpi."""
    values = string_pool([ICON_PATH])
    type_strings = string_pool(["drawable"])
    key_strings = string_pool(["ic_launcher"])

    spec = struct.pack("<HHIBBHI", 0x0202, 16, 16 + 4, 1, 0, 0, 1) + struct.pack("<I", 0x00000100)

    config = bytearray(64)
    struct.pack_into("<I", config, 0, 64)
    struct.pack_into("<H", config, 14, 640)  # density xxxhdpi
    entry = struct.pack("<HHI", 8, 0, 0) + struct.pack("<HBBI", 8, 0, T_STRING, 0)
    type_header = 20 + 64
    entries_start = type_header + 4
    typ = (struct.pack("<HHIBBHII", 0x0201, type_header, entries_start + len(entry), 1, 0, 0, 1, entries_start)
           + bytes(config) + struct.pack("<I", 0) + entry)

    name = PKG.encode("utf-16-le").ljust(256, b"\0")
    pkg_header = 288
    type_off = pkg_header
    key_off = type_off + len(type_strings)
    pkg_body = type_strings + key_strings + spec + typ
    pkg = struct.pack("<HHII", 0x0200, pkg_header, pkg_header + len(pkg_body), 0x7F) + name + struct.pack(
        "<IIIII", type_off, 1, key_off, 1, 0) + pkg_body
    assert len(pkg) == pkg_header + len(pkg_body)

    body = values + pkg
    return struct.pack("<HHII", 0x0002, 12, 12 + len(body), 1) + body


def write_aligned(zf, name, data, compress):
    """Store uncompressed entries 4-byte aligned (required for resources.arsc on API 30+)."""
    if compress:
        zf.writestr(zipfile.ZipInfo(name, (2024, 1, 1, 0, 0, 0)), data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        return
    zi = zipfile.ZipInfo(name, (2024, 1, 1, 0, 0, 0))
    zi.compress_type = zipfile.ZIP_STORED
    offset = zf.fp.tell() + 30 + len(name.encode())
    pad = (-(offset + 4)) % 4
    zi.extra = struct.pack("<HH", 0xD935, pad) + b"\0" * pad
    zf.writestr(zi, data)


def main():
    out, dex, icon, assets = sys.argv[1:5]
    with zipfile.ZipFile(out, "w") as zf:
        write_aligned(zf, "AndroidManifest.xml", manifest(), True)
        write_aligned(zf, "resources.arsc", resources_arsc(), False)
        write_aligned(zf, "classes.dex", open(dex, "rb").read(), True)
        write_aligned(zf, ICON_PATH, open(icon, "rb").read(), False)
        for root, _, files in os.walk(assets):
            for f in sorted(files):
                p = os.path.join(root, f)
                write_aligned(zf, "assets/" + os.path.relpath(p, assets).replace(os.sep, "/"), open(p, "rb").read(), True)
    print("packed", out, os.path.getsize(out), "bytes")


if __name__ == "__main__":
    main()
