import React from "react";
import {Composition} from "remotion";
import {RendezvousVideo} from "./RendezvousVideo";

export const RendezvousVideoRoot: React.FC = () => (
  <Composition
    id="Rendezvous"
    component={RendezvousVideo}
    durationInFrames={1800}
    fps={30}
    width={1920}
    height={1080}
  />
);
