import { useCallback, useEffect, useRef, useState } from "react";
import { querySelf, updateSelf } from "neutron-tools/app";

type Meeting = { id: Uint8Array; title: string; peer: string; initiator: boolean };
type Signal = { sequence: string; signal_id: Uint8Array; kind: string; payload: string };
type SignalPage = { latest_sequence: string; signals: Signal[] };

const random16 = () => crypto.getRandomValues(new Uint8Array(16));
const describeError = (error: unknown) => {
  const value = error instanceof Error ? error.message : String(error);
  return value.includes("NotAllowedError") ? "Browser permission was denied" : value;
};

export function MeetingPanel({ fallbackTitle, onClose }: { fallbackTitle: string; onClose: () => void }) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const meeting = useRef<Meeting | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const peer = useRef<RTCPeerConnection | null>(null);
  const pollTimer = useRef<number | undefined>(undefined);
  const afterSequence = useRef("0");
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const sendChain = useRef<Promise<void>>(Promise.resolve());
  const closed = useRef(false);
  const [title, setTitle] = useState(fallbackTitle);
  const [status, setStatus] = useState("Loading confirmed meeting…");
  const [connection, setConnection] = useState("Not connected");
  const [started, setStarted] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const send = useCallback((kind: "description" | "candidate" | "end", value: unknown): Promise<void> => {
    const task = sendChain.current.then(async () => {
      if (!meeting.current || closed.current) return;
      await updateSelf("rendezvous_signal_send_v1", [{ negotiation_id: meeting.current.id, signal_id: random16(), kind, payload: JSON.stringify(value) }], 30);
    });
    sendChain.current = task.catch(() => undefined);
    return task;
  }, []);

  const stopDevices = useCallback(() => {
    if (pollTimer.current !== undefined) clearTimeout(pollTimer.current);
    pollTimer.current = undefined;
    pendingCandidates.current = [];
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  }, []);

  const receive = useCallback(async (signal: Signal): Promise<void> => {
    const currentPeer = peer.current;
    const currentMeeting = meeting.current;
    if (!currentPeer || !currentMeeting || closed.current) return;
    if (signal.kind === "end") {
      setStatus("The other person left");
      stopDevices();
      currentPeer.close();
      peer.current = null;
      return;
    }
    if (signal.kind === "description") {
      const description = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
      const offerCollision = description.type === "offer" && (makingOffer.current || currentPeer.signalingState !== "stable");
      ignoreOffer.current = currentMeeting.initiator && offerCollision;
      if (ignoreOffer.current) { pendingCandidates.current = []; return; }
      await currentPeer.setRemoteDescription(description);
      const queued = pendingCandidates.current;
      pendingCandidates.current = [];
      for (const candidate of queued) await currentPeer.addIceCandidate(candidate);
      if (description.type === "offer") {
        await currentPeer.setLocalDescription();
        await send("description", currentPeer.localDescription);
      }
      return;
    }
    if (signal.kind === "candidate") {
      if (ignoreOffer.current) return;
      const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
      if (!currentPeer.remoteDescription) pendingCandidates.current.push(candidate);
      else await currentPeer.addIceCandidate(candidate);
    }
  }, [send, stopDevices]);

  const poll = useCallback(async function pollSignals(): Promise<void> {
    if (!meeting.current || !peer.current || closed.current) return;
    try {
      const page = await querySelf<SignalPage>("rendezvous_signal_poll_v1", [{ negotiation_id: meeting.current.id, after_sequence: afterSequence.current }]);
      for (const signal of page.signals) await receive(signal);
      afterSequence.current = page.latest_sequence;
    } catch (error) {
      if (!closed.current) setStatus(describeError(error));
    }
    if (!closed.current && peer.current) pollTimer.current = window.setTimeout(() => void pollSignals(), 500);
  }, [receive]);

  const startDevices = async () => {
    try {
      if (!meeting.current) throw new Error("The confirmed meeting is unavailable");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera and microphone are unavailable in this browser context");
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const currentPeer = new RTCPeerConnection();
      peer.current = currentPeer;
      currentPeer.ontrack = ({ streams }) => {
        if (remoteVideo.current) remoteVideo.current.srcObject = streams[0] ?? new MediaStream();
        setRemoteReady(true);
      };
      currentPeer.onconnectionstatechange = () => {
        setConnection(currentPeer.connectionState === "connected" ? "Direct browser connection" : currentPeer.connectionState);
        if (currentPeer.connectionState === "connected") setStatus("Connected directly — media stays between browsers");
        if (currentPeer.connectionState === "failed") setStatus("The direct connection failed. TURN relay is not configured.");
      };
      currentPeer.onicecandidate = ({ candidate }) => {
        if (candidate) void send("candidate", candidate.toJSON()).catch((error) => setStatus(describeError(error)));
      };
      currentPeer.onnegotiationneeded = async () => {
        try {
          makingOffer.current = true;
          await currentPeer.setLocalDescription();
          await send("description", currentPeer.localDescription);
        } catch (error) {
          setStatus(describeError(error));
        } finally {
          makingOffer.current = false;
        }
      };
      for (const track of stream.current.getTracks()) currentPeer.addTrack(track, stream.current);
      if (localVideo.current) localVideo.current.srcObject = stream.current;
      setStarted(true);
      setStatus("Devices ready — connecting to the other person");
      void poll();
    } catch (error) {
      setStatus(describeError(error));
    }
  };

  const leave = async () => {
    try { await send("end", null); } catch { /* expiry still bounds remote state */ }
    closed.current = true;
    stopDevices();
    peer.current?.close();
    peer.current = null;
    await updateSelf("rendezvous_media_close_v1", [null]).catch(() => undefined);
    onClose();
  };

  useEffect(() => {
    void querySelf<Meeting>("rendezvous_media_current_v1", [null]).then((result) => {
      meeting.current = result;
      setTitle(result.title);
      setStatus("Devices are off");
    }).catch((error) => setStatus(describeError(error)));
    return () => {
      closed.current = true;
      stopDevices();
      peer.current?.close();
      peer.current = null;
      void updateSelf("rendezvous_media_close_v1", [null]).catch(() => undefined);
    };
  }, [stopDevices]);

  const toggleMic = () => {
    const track = stream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicEnabled(track.enabled);
  };
  const toggleCamera = () => {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraEnabled(track.enabled);
  };

  return <section aria-labelledby="meeting-title" aria-modal="true" className="meeting-panel" role="dialog">
    <header><div><span className="meeting-active">Camera + Microphone</span><h2 id="meeting-title">{title}</h2></div><span>{connection}</span></header>
    <div className="meeting-videos">
      <section aria-label="Remote video" className="meeting-video"><div className="meeting-empty" hidden={remoteReady}>Waiting for the other person</div><video aria-label="Remote participant" autoPlay hidden={!remoteReady} playsInline ref={remoteVideo} /></section>
      <section aria-label="Your video" className="meeting-video"><div className="meeting-empty" hidden={started}>Start devices when you are ready</div><video aria-label="Your camera" autoPlay hidden={!started} muted playsInline ref={localVideo} /></section>
    </div>
    <footer>
      {!started && <button className="nt-button" onClick={() => void startDevices()} type="button">Start camera &amp; microphone</button>}
      <button className="nt-button nt-button--sm" disabled={!started} onClick={toggleMic} type="button">{micEnabled ? "Mute" : "Unmute"}</button>
      <button className="nt-button nt-button--sm" disabled={!started} onClick={toggleCamera} type="button">{cameraEnabled ? "Camera off" : "Camera on"}</button>
      <button className="nt-button nt-button--sm meeting-leave" onClick={() => void leave()} type="button">Leave meeting</button>
      <output aria-live="polite">{status}</output>
    </footer>
  </section>;
}
