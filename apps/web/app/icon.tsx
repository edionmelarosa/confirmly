import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  // next/og's ImageResponse renders via satori, not the DOM/Tailwind pipeline — inline style is the only styling API it accepts.
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          background: "#0d9488",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          borderRadius: 6,
        }}
      >
        C
      </div>
    ),
    { ...size },
  );
}
