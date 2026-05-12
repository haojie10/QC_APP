import React from "react";
import { Composition } from "remotion";
import { Main } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Main"
        component={Main}
        durationInFrames={1000} // Expanded video duration for extended animations
        fps={30}
        width={1080}
        height={1920} // Vertical video for mobile app feel
      />
    </>
  );
};
