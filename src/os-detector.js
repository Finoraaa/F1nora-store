/**
 * Finora's Store - Operating System & Architecture Detection Engine
 */

export function detectUserOS() {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();

  // Android check (before Linux because Android contains "linux")
  if (/android/.test(ua)) {
    return {
      id: 'android',
      name: 'Android',
      badge: 'Android (.apk)',
      icon: 'smartphone',
      extensions: ['.apk', '.aab']
    };
  }

  // iOS check (iPhone, iPad, iPod)
  if (/iphone|ipad|ipod/.test(ua) || (platform === 'macintel' && navigator.maxTouchPoints > 1)) {
    return {
      id: 'ios',
      name: 'iOS',
      badge: 'iOS (.ipa / Web)',
      icon: 'apple',
      extensions: ['.ipa']
    };
  }

  // Windows check
  if (/win/.test(platform) || /windows/.test(ua)) {
    return {
      id: 'windows',
      name: 'Windows',
      badge: 'Windows (.exe / .msi)',
      icon: 'laptop',
      extensions: ['.exe', '.msi', '.zip']
    };
  }

  // macOS check
  if (/mac/.test(platform) || /macintosh|mac os x/.test(ua)) {
    return {
      id: 'macos',
      name: 'macOS',
      badge: 'macOS (.dmg / .pkg)',
      icon: 'apple',
      extensions: ['.dmg', '.pkg', '.zip']
    };
  }

  // Linux check (Debian / Ubuntu / Generic Linux)
  if (/linux/.test(platform) || /linux/.test(ua)) {
    const isDebian = /debian|ubuntu|mint|pop!_os|kali/i.test(ua);
    return {
      id: 'linux',
      name: isDebian ? 'Linux (Debian / Ubuntu)' : 'Linux',
      badge: 'Linux (.deb / .AppImage)',
      icon: 'hard-drive',
      isDebian: true,
      extensions: ['.deb', '.appimage', '.tar.gz', '.tar.xz', '.rpm']
    };
  }

  // Default fallback
  return {
    id: 'unknown',
    name: 'Universal / Web',
    badge: 'Universal',
    icon: 'monitor',
    extensions: []
  };
}

export function classifyAsset(filename) {
  const name = filename.toLowerCase();

  // Android
  if (name.endsWith('.apk') || name.endsWith('.aab')) {
    let arch = 'Universal';
    if (name.includes('arm64-v8a') || name.includes('aarch64')) arch = 'ARM64';
    else if (name.includes('armeabi-v7a') || name.includes('armv7')) arch = 'ARMv7';
    else if (name.includes('x86_64')) arch = 'x86_64';
    return { os: 'android', format: name.endsWith('.apk') ? 'APK' : 'AAB', arch, label: `Android ${arch} (${name.endsWith('.apk') ? '.apk' : '.aab'})` };
  }

  // Windows
  if (name.endsWith('.exe') || name.endsWith('.msi') || (name.endsWith('.zip') && (name.includes('win') || name.includes('windows')))) {
    let arch = 'x64';
    if (name.includes('arm64')) arch = 'ARM64';
    else if (name.includes('x86') || name.includes('win32') || name.includes('ia32')) arch = '32-bit';
    const ext = name.endsWith('.exe') ? '.exe' : name.endsWith('.msi') ? '.msi' : '.zip';
    return { os: 'windows', format: ext.toUpperCase().replace('.', ''), arch, label: `Windows ${arch} (${ext})` };
  }

  // Linux - Debian / Ubuntu (.deb)
  if (name.endsWith('.deb')) {
    let arch = 'amd64';
    if (name.includes('arm64') || name.includes('aarch64')) arch = 'arm64';
    else if (name.includes('armhf')) arch = 'armhf';
    return { os: 'linux', subtype: 'deb', format: 'DEB', arch, label: `Debian / Ubuntu (${arch}.deb)` };
  }

  // Linux - AppImage
  if (name.endsWith('.appimage')) {
    let arch = 'x86_64';
    if (name.includes('arm64') || name.includes('aarch64')) arch = 'arm64';
    return { os: 'linux', subtype: 'appimage', format: 'AppImage', arch, label: `Universal Linux (${arch}.AppImage)` };
  }

  // Linux - RPM
  if (name.endsWith('.rpm')) {
    return { os: 'linux', subtype: 'rpm', format: 'RPM', arch: 'x86_64', label: `Fedora / RedHat (.rpm)` };
  }

  // macOS
  if (name.endsWith('.dmg') || name.endsWith('.pkg') || (name.endsWith('.zip') && (name.includes('mac') || name.includes('darwin') || name.includes('osx')))) {
    let arch = 'Universal';
    if (name.includes('arm64') || name.includes('aarch64') || name.includes('m1') || name.includes('apple-silicon')) arch = 'Apple Silicon';
    else if (name.includes('x64') || name.includes('x86_64') || name.includes('intel')) arch = 'Intel';
    const ext = name.endsWith('.dmg') ? '.dmg' : name.endsWith('.pkg') ? '.pkg' : '.zip';
    return { os: 'macos', format: ext.toUpperCase().replace('.', ''), arch, label: `macOS ${arch} (${ext})` };
  }

  // iOS
  if (name.endsWith('.ipa')) {
    return { os: 'ios', format: 'IPA', arch: 'ARM64', label: `iOS (.ipa)` };
  }

  // Generic Linux tarball
  if (name.endsWith('.tar.gz') || name.endsWith('.tar.xz') || name.endsWith('.tgz')) {
    if (name.includes('linux')) {
      return { os: 'linux', subtype: 'tarball', format: 'TAR', arch: 'Generic', label: `Linux Archive (${name.split('.').slice(-2).join('.')})` };
    }
  }

  return { os: 'other', format: 'OTHER', arch: 'Unknown', label: filename };
}

export function pickBestAssetForOS(assets, targetOSId) {
  if (!assets || assets.length === 0) return null;

  const classified = assets.map(asset => ({
    asset,
    meta: classifyAsset(asset.name)
  }));

  // Target OS preferences
  if (targetOSId === 'windows') {
    // Prefer .exe (x64) -> .msi -> other windows
    return (
      classified.find(c => c.meta.os === 'windows' && c.meta.format === 'EXE' && c.meta.arch === 'x64')?.asset ||
      classified.find(c => c.meta.os === 'windows' && c.meta.format === 'EXE')?.asset ||
      classified.find(c => c.meta.os === 'windows' && c.meta.format === 'MSI')?.asset ||
      classified.find(c => c.meta.os === 'windows')?.asset ||
      null
    );
  }

  if (targetOSId === 'android') {
    // Prefer universal apk -> arm64-v8a apk -> any apk
    return (
      classified.find(c => c.meta.os === 'android' && c.meta.format === 'APK' && c.meta.arch === 'Universal')?.asset ||
      classified.find(c => c.meta.os === 'android' && c.meta.format === 'APK' && c.meta.arch === 'ARM64')?.asset ||
      classified.find(c => c.meta.os === 'android' && c.meta.format === 'APK')?.asset ||
      classified.find(c => c.meta.os === 'android')?.asset ||
      null
    );
  }

  if (targetOSId === 'linux') {
    // If Debian/Ubuntu preferred: .deb -> .AppImage -> .tar.gz
    return (
      classified.find(c => c.meta.os === 'linux' && c.meta.subtype === 'deb' && c.meta.arch === 'amd64')?.asset ||
      classified.find(c => c.meta.os === 'linux' && c.meta.subtype === 'deb')?.asset ||
      classified.find(c => c.meta.os === 'linux' && c.meta.subtype === 'appimage')?.asset ||
      classified.find(c => c.meta.os === 'linux')?.asset ||
      null
    );
  }

  if (targetOSId === 'macos') {
    // Prefer .dmg (Apple Silicon or Universal) -> .pkg -> .zip
    return (
      classified.find(c => c.meta.os === 'macos' && c.meta.format === 'DMG' && c.meta.arch === 'Apple Silicon')?.asset ||
      classified.find(c => c.meta.os === 'macos' && c.meta.format === 'DMG' && c.meta.arch === 'Universal')?.asset ||
      classified.find(c => c.meta.os === 'macos' && c.meta.format === 'DMG')?.asset ||
      classified.find(c => c.meta.os === 'macos' && c.meta.format === 'PKG')?.asset ||
      classified.find(c => c.meta.os === 'macos')?.asset ||
      null
    );
  }

  if (targetOSId === 'ios') {
    return classified.find(c => c.meta.os === 'ios')?.asset || null;
  }

  return assets[0] || null;
}
