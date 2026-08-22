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
  bg: "#07100d",
  panel: "#0d1713",
  ink: "#f4fff8",
  muted: "#a6b9ae",
  mint: "#9af0bc",
  blue: "#53a6e8",
  violet: "#9d82e6",
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
  <div style={{color: colors.mint, fontSize: 24, fontWeight: 850, letterSpacing: 4, textTransform: "uppercase"}}>{children}</div>
);

const Headline: React.FC<React.PropsWithChildren> = ({children}) => (
  <div style={{fontSize: 72, lineHeight: 1.04, fontWeight: 880, letterSpacing: -3, maxWidth: 1120}}>{children}</div>
);

const Copy: React.FC<React.PropsWithChildren> = ({children}) => (
  <div style={{fontSize: 32, lineHeight: 1.4, color: colors.muted, maxWidth: 1060}}>{children}</div>
);

const ProductFrame: React.FC<{src: string; side?: "left" | "right"; style?: React.CSSProperties}> = ({src, side = "right", style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entrance = spring({frame, fps, config: {damping: 18, stiffness: 90}});
  const x = interpolate(entrance, [0, 1], [side === "right" ? 120 : -120, 0]);
  return (
    <div style={{border: "1px solid #2a3d34", borderRadius: 24, overflow: "hidden", boxShadow: "0 40px 100px #000a", transform: `translateX(${x}px)`, background: colors.panel, ...style}}>
      <Img src={staticFile(`assets/${src}`)} style={{display: "block", width: "100%"}} />
    </div>
  );
};

const TitleScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = spring({frame, fps, config: {damping: 16, stiffness: 75}});
  return (
    <Scene duration={duration}>
      <AbsoluteFill style={{alignItems: "center", justifyContent: "center", textAlign: "center", gap: 28}}>
        <Img src={staticFile("assets/calendar-icon.png")} style={{width: 230, height: 230, borderRadius: 48, transform: `scale(${interpolate(reveal, [0, 1], [.72, 1])})`, boxShadow: "0 30px 100px #66d99a44"}} />
        <div style={{fontSize: 116, fontWeight: 920, letterSpacing: -6}}>Calendar</div>
        <div style={{fontSize: 40, color: colors.muted}}>A real calendar inside your personal Neutron.</div>
      </AbsoluteFill>
    </Scene>
  );
};

const SplitScene: React.FC<{duration: number; eyebrow: string; title: React.ReactNode; copy: React.ReactNode; image: string; flip?: boolean}> = ({duration, eyebrow, title, copy, image, flip = false}) => (
  <Scene duration={duration}>
    <AbsoluteFill style={{padding: "100px 105px", display: "grid", gridTemplateColumns: "0.72fr 1.28fr", alignItems: "center", gap: 66}}>
      <div style={{display: "flex", flexDirection: "column", gap: 30, order: flip ? 2 : 1}}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Headline>{title}</Headline>
        <Copy>{copy}</Copy>
      </div>
      <div style={{order: flip ? 1 : 2}}><ProductFrame src={image} side={flip ? "left" : "right"} /></div>
    </AbsoluteFill>
  </Scene>
);

const ViewsScene: React.FC<{duration: number}> = ({duration}) => (
  <Scene duration={duration}>
    <AbsoluteFill style={{padding: "68px 90px", gap: 30}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "end"}}>
        <div><Eyebrow>Plan your way</Eyebrow><div style={{fontSize: 58, fontWeight: 870, marginTop: 12}}>Month. Week. Day. Agenda.</div></div>
        <div style={{fontSize: 27, color: colors.muted}}>Drag, resize, block time, and edit in place.</div>
      </div>
      <ProductFrame src="01-week-calendar.jpg" style={{height: 790}} />
    </AbsoluteFill>
  </Scene>
);

const PrivacyScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const cards = [
    ["01", "Stored locally", "Titles, notes, locations, recurrence, and busy state live in your Neutron."],
    ["02", "Owner controlled", "Your Internet Identity principal controls access to the Calendar instance."],
    ["03", "Safe to compose", "Other apps can request bounded availability without receiving your private event details."],
  ];
  return (
    <Scene duration={duration}>
      <AbsoluteFill style={{padding: "100px 120px", justifyContent: "center", gap: 55}}>
        <Eyebrow>Private by default</Eyebrow>
        <Headline>Your schedule belongs to you.</Headline>
        <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28}}>
          {cards.map(([number, title, body], index) => {
            const rise = interpolate(frame, [index * 8, index * 8 + 22], [35, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)});
            return <div key={number} style={{background: colors.panel, border: "1px solid #294237", borderRadius: 24, padding: 34, minHeight: 250, transform: `translateY(${rise}px)`}}>
              <div style={{color: colors.mint, fontWeight: 850, fontSize: 24}}>{number}</div>
              <div style={{fontSize: 34, fontWeight: 840, margin: "20px 0 12px"}}>{title}</div>
              <div style={{fontSize: 25, lineHeight: 1.4, color: colors.muted}}>{body}</div>
            </div>;
          })}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const ResponsiveScene: React.FC<{duration: number}> = ({duration}) => (
  <Scene duration={duration}>
    <AbsoluteFill style={{padding: "80px 150px", display: "grid", gridTemplateColumns: "520px 1fr", gap: 105, alignItems: "center"}}>
      <ProductFrame src="05-mobile-agenda.jpg" side="left" style={{width: 430, justifySelf: "center"}} />
      <div style={{display: "flex", flexDirection: "column", gap: 30}}>
        <Eyebrow>Every screen</Eyebrow>
        <Headline>Your day stays useful on the move.</Headline>
        <Copy>The responsive agenda preserves the same events, colors, and controls in a focused mobile layout.</Copy>
        <div style={{display: "flex", gap: 15, marginTop: 10}}>
          {["Responsive", "Accessible", "No account silo"].map((item) => <div key={item} style={{padding: "13px 20px", border: "1px solid #385749", borderRadius: 999, fontSize: 23, color: colors.muted}}>{item}</div>)}
        </div>
      </div>
    </AbsoluteFill>
  </Scene>
);

const ClosingScene: React.FC<{duration: number}> = ({duration}) => (
  <Scene duration={duration}>
    <AbsoluteFill style={{alignItems: "center", justifyContent: "center", textAlign: "center", gap: 34, padding: 120}}>
      <Eyebrow>Built for Neutron</Eyebrow>
      <Headline>A full-featured calendar.<br />One install. Your data.</Headline>
      <div style={{display: "flex", gap: 18, marginTop: 18}}>
        {["Standalone", "Recurring events", "Busy / free", "Local-first"].map((item) => <div key={item} style={{padding: "16px 24px", border: "1px solid #385749", borderRadius: 999, fontSize: 24, color: colors.muted}}>{item}</div>)}
      </div>
      <div style={{fontSize: 42, color: colors.mint, fontWeight: 850, marginTop: 24}}>Calendar</div>
    </AbsoluteFill>
  </Scene>
);

export const CalendarVideo: React.FC = () => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 18%, #173426 0, ${colors.bg} 60%)`, color: colors.ink, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"}}>
    <Sequence from={0} durationInFrames={150}><TitleScene duration={150} /></Sequence>
    <Sequence from={150} durationInFrames={270}><ViewsScene duration={270} /></Sequence>
    <Sequence from={420} durationInFrames={270}><SplitScene duration={270} eyebrow="Real recurrence" title={<>Repeat precisely.<br />Change safely.</>} copy="Create weekly series, choose exact weekdays, set occurrence limits, and edit one event or the entire series." image="02-recurring-series.jpg" flip /></Sequence>
    <Sequence from={690} durationInFrames={250}><SplitScene duration={250} eyebrow="Details that matter" title="Everything needed to plan." copy="Keep location, notes, color, busy/free status, and timezone-resolved start and end times together." image="04-event-details.jpg" /></Sequence>
    <Sequence from={940} durationInFrames={270}><PrivacyScene duration={270} /></Sequence>
    <Sequence from={1210} durationInFrames={280}><ResponsiveScene duration={280} /></Sequence>
    <Sequence from={1490} durationInFrames={310}><ClosingScene duration={310} /></Sequence>
  </AbsoluteFill>
);
