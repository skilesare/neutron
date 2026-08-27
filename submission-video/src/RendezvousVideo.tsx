import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const colors = {
  bg: "#070811",
  panel: "#10111d",
  ink: "#f7f5ff",
  muted: "#aaa7bd",
  lavender: "#a99bff",
  coral: "#ff8075",
  mint: "#62ead0",
};

const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 18, duration - 18, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const Scene: React.FC<React.PropsWithChildren<{duration: number}>> = ({duration, children}) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{opacity: fade(frame, duration)}}>{children}</AbsoluteFill>;
};

const Eyebrow: React.FC<React.PropsWithChildren> = ({children}) => (
  <div style={{color: colors.mint, fontSize: 24, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase"}}>{children}</div>
);

const Headline: React.FC<React.PropsWithChildren> = ({children}) => (
  <div style={{fontSize: 72, lineHeight: 1.03, fontWeight: 850, letterSpacing: -3, maxWidth: 1100}}>{children}</div>
);

const Copy: React.FC<React.PropsWithChildren> = ({children}) => (
  <div style={{fontSize: 34, lineHeight: 1.35, color: colors.muted, maxWidth: 1160}}>{children}</div>
);

const ProductFrame: React.FC<{src: string; side?: "left" | "right"; scale?: number}> = ({src, side = "right", scale = 1}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({frame, fps, config: {damping: 18, stiffness: 90}});
  const x = interpolate(entrance, [0, 1], [side === "right" ? 120 : -120, 0]);
  return (
    <div style={{border: "1px solid #2d3042", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 100px #000a", transform: `translateX(${x}px) scale(${scale})`, background: colors.panel}}>
      <Img src={staticFile(`assets/${src}`)} style={{display: "block", width: "100%"}} />
    </div>
  );
};

const SplitScene: React.FC<{duration: number; eyebrow: string; title: React.ReactNode; copy: React.ReactNode; image: string; flip?: boolean}> = ({duration, eyebrow, title, copy, image, flip = false}) => (
  <Scene duration={duration}>
    <AbsoluteFill style={{padding: "110px 120px", display: "grid", gridTemplateColumns: "0.78fr 1.22fr", alignItems: "center", gap: 72}}>
      <div style={{display: "flex", flexDirection: "column", gap: 30, order: flip ? 2 : 1}}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Headline>{title}</Headline>
        <Copy>{copy}</Copy>
      </div>
      <div style={{order: flip ? 1 : 2}}><ProductFrame src={image} side={flip ? "left" : "right"} /></div>
    </AbsoluteFill>
  </Scene>
);

const TitleScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = spring({frame, fps, config: {damping: 16, stiffness: 75}});
  return (
    <Scene duration={duration}>
      <AbsoluteFill style={{alignItems: "center", justifyContent: "center", textAlign: "center", gap: 28}}>
        <Img src={staticFile("assets/rendezvous-icon.png")} style={{width: 230, height: 230, borderRadius: 48, transform: `scale(${interpolate(reveal, [0, 1], [.72, 1])})`, boxShadow: "0 30px 100px #5e4dff55"}} />
        <div style={{fontSize: 116, fontWeight: 900, letterSpacing: -6}}>Rendezvous</div>
        <div style={{fontSize: 40, color: colors.muted}}>Private scheduling between sovereign personal clouds.</div>
      </AbsoluteFill>
    </Scene>
  );
};

const PrivacyScene: React.FC<{duration: number}> = ({duration}) => (
  <Scene duration={duration}>
    <AbsoluteFill style={{padding: "100px 120px", justifyContent: "center", gap: 55}}>
      <Eyebrow>No scheduling server</Eyebrow>
      <Headline>Your calendar never leaves your Neutron.</Headline>
      <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28}}>
        {[
          ["01", "Filter locally", "Private titles, notes and busy intervals stay home."],
          ["02", "Share candidates", "Only selected times and bounded proposal state cross the wire."],
          ["03", "Confirm safely", "Holds, revisions and final revalidation prevent double-booking."],
        ].map(([number, title, body]) => (
          <div key={number} style={{background: colors.panel, border: "1px solid #292b3c", borderRadius: 24, padding: 34, minHeight: 230}}>
            <div style={{color: colors.lavender, fontWeight: 800, fontSize: 24}}>{number}</div>
            <div style={{fontSize: 35, fontWeight: 800, margin: "20px 0 12px"}}>{title}</div>
            <div style={{fontSize: 25, lineHeight: 1.4, color: colors.muted}}>{body}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  </Scene>
);

const CalendarsScene: React.FC<{duration: number}> = ({duration}) => (
  <Scene duration={duration}>
    <AbsoluteFill style={{padding: "72px 90px", gap: 28}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "end"}}>
        <div><Eyebrow>One agreement</Eyebrow><div style={{fontSize: 56, fontWeight: 850, marginTop: 12}}>Two independently owned calendars</div></div>
        <div style={{fontSize: 27, color: colors.muted}}>Same confirmed time. No shared database.</div>
      </div>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28}}>
        <div style={{display: "flex", flexDirection: "column", gap: 14}}>
          <div style={{fontSize: 25, color: colors.lavender, fontWeight: 800}}>Alice's Neutron</div>
          <ProductFrame src="03-alice-confirmed-calendar.jpg" side="left" />
        </div>
        <div style={{display: "flex", flexDirection: "column", gap: 14}}>
          <div style={{fontSize: 25, color: colors.coral, fontWeight: 800}}>Bob's Neutron</div>
          <ProductFrame src="04-bob-confirmed-calendar.jpg" side="right" />
        </div>
      </div>
    </AbsoluteFill>
  </Scene>
);

const ClosingScene: React.FC<{duration: number}> = ({duration}) => (
  <Scene duration={duration}>
    <AbsoluteFill style={{alignItems: "center", justifyContent: "center", textAlign: "center", gap: 34, padding: 120}}>
      <Eyebrow>Built for Neutron</Eyebrow>
      <Headline>Meet without giving your calendar—or your media—to a platform.</Headline>
      <div style={{display: "flex", gap: 18, marginTop: 18}}>
        {["Local-first", "Peer-to-peer", "Conflict-safe", "Owner-controlled"].map((item) => <div key={item} style={{padding: "16px 24px", border: "1px solid #44405f", borderRadius: 999, fontSize: 24, color: colors.muted}}>{item}</div>)}
      </div>
      <div style={{fontSize: 42, color: colors.lavender, fontWeight: 800, marginTop: 24}}>Rendezvous</div>
    </AbsoluteFill>
  </Scene>
);

export const RendezvousVideo: React.FC = () => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 20%, #19152f 0, ${colors.bg} 58%)`, color: colors.ink, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"}}>
    <Sequence from={0} durationInFrames={150}><TitleScene duration={150} /></Sequence>
    <Sequence from={150} durationInFrames={210}><PrivacyScene duration={210} /></Sequence>
    <Sequence from={360} durationInFrames={240}><SplitScene duration={240} eyebrow="Compose locally" title={<>Choose the people.<br />Choose the times.</>} copy="Rendezvous searches your Contacts and Calendar without exposing either one to the peer." image="01-alice-proposal.jpg" /></Sequence>
    <Sequence from={600} durationInFrames={240}><SplitScene duration={240} eyebrow="Authenticated delivery" title="Know exactly who invited you." copy="The recipient sees their own trusted Contact name plus the authenticated peer Neutron principal." image="02-bob-received.jpg" flip /></Sequence>
    <Sequence from={840} durationInFrames={270}><CalendarsScene duration={270} /></Sequence>
    <Sequence from={1110} durationInFrames={270}><SplitScene duration={270} eyebrow="Direct browser media" title="Turn the meeting into a call." copy="Neutron grants camera and microphone only to Rendezvous's declared app tile. Media flows browser to browser." image="07-direct-video.jpg" /></Sequence>
    <Sequence from={1380} durationInFrames={420}><ClosingScene duration={420} /></Sequence>
  </AbsoluteFill>
);
