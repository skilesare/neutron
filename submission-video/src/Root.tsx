import React from "react";
import {Composition} from "remotion";
import {CalendarVideo} from "./CalendarVideo";

export const CalendarVideoRoot: React.FC = () => (
  <Composition
    id="Calendar"
    component={CalendarVideo}
    durationInFrames={1800}
    fps={30}
    width={1920}
    height={1080}
  />
);
