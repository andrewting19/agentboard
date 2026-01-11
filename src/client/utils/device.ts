export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua)
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iOS || iPadOS
}

export function isIOSPWA(): boolean {
  if (typeof navigator === 'undefined') return false
  return isIOSDevice() && (navigator as { standalone?: boolean }).standalone === true
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // Safari but not Chrome (Chrome includes "Safari" in its UA)
  return /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua)
}
