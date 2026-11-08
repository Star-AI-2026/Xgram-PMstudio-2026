/**
 * WebRTC helpers for Xgram calls.
 * Audio-only today; the peer-connection factory is generic so video or group
 * calls can be layered on later without touching the signaling layer.
 */

/** Reads ICE servers from env so TURN credentials are never hardcoded. */
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];

  const turnUrls = (import.meta.env["VITE_TURN_URLS"] as string | undefined)?.trim();
  if (turnUrls) {
    const username = import.meta.env["VITE_TURN_USERNAME"] as string | undefined;
    const credential = import.meta.env["VITE_TURN_CREDENTIAL"] as string | undefined;
    servers.push({
      urls: turnUrls.split(",").map((entry) => entry.trim()).filter(Boolean),
      ...(username ? { username } : {}),
      ...(credential ? { credential } : {}),
    });
  }

  return servers;
}

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: getIceServers(), iceCandidatePoolSize: 4 });
}

/** Asks for microphone access only — no video track is ever requested. */
export async function getMicrophoneStream(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone is not available in this browser");
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
