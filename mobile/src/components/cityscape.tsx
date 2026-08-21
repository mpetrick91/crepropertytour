import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

/**
 * The skyline behind a tour card.
 *
 * A photograph of the market would be better, and this is built so one can
 * replace it: pass `photoUrl` and the artwork steps aside. Until there is a
 * licensed source for those photographs, drawing the skyline avoids the two
 * ways stock imagery fails in a product like this -- a licence attached to
 * every screen, and a card that renders as a grey box on a sidewalk with one
 * bar of signal.
 *
 * The shape is seeded by the market name, so Grand Rapids always gets the same
 * skyline and a different one from Columbus. Not a likeness of either city;
 * a piece of scenery that stays put.
 */

/** Deterministic noise from a string. Small, repeatable, good enough for shapes. */
function seededRandom(seed: string): () => number {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return () => {
    // xorshift: cheap, and stable across platforms unlike Math.random.
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    return value / 0xffffffff;
  };
}

type Tower = { width: number; height: number; windows: boolean[]; gap: number };

function skyline(seed: string, count: number): Tower[] {
  const random = seededRandom(seed || "market");

  return Array.from({ length: count }, (_, index) => {
    // Taller towers toward the middle, so the silhouette has a centre of mass
    // rather than reading as a random fence.
    const centreBias = 1 - Math.abs(index - (count - 1) / 2) / (count / 1.6);
    const height = 0.34 + centreBias * 0.42 + random() * 0.22;
    const width = 16 + random() * 22;
    const rows = Math.max(2, Math.round(height * 9));

    return {
      width,
      height: Math.min(height, 0.96),
      gap: random() * 5,
      // A lit window here and there, never a full grid -- an office block at
      // dusk is mostly dark.
      windows: Array.from({ length: rows * 2 }, () => random() > 0.72),
    };
  });
}

export function Cityscape({
  market,
  height = 150,
  tint = "night",
  photoUrl,
}: {
  market?: string | null;
  height?: number;
  /** `dusk` warms the sky, for a tour that is under way. */
  tint?: "night" | "dusk";
  /**
   * A real photograph of the market, once there is somewhere to get one from.
   * The drawn skyline stays as the fallback rather than being replaced, so a
   * card with no photo -- or one that fails to load -- still has a scene.
   */
  photoUrl?: string | null;
}) {
  const towers = skyline(market ?? "", 11);

  const sky: [string, string, string] =
    tint === "dusk"
      ? ["#7A3B10", "#B4681C", "#FAA61A"]
      : ["#061027", "#0A2158", "#1A3C82"];
  const silhouette = tint === "dusk" ? "#3A1C08" : "#050B18";

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height,
        overflow: "hidden",
      }}
    >
      <LinearGradient colors={sky} style={{ ...StyleSheetAbsolute }} />

      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={StyleSheetAbsolute}
          contentFit="cover"
          transition={220}
          // Drawn underneath while the photo loads, and left showing if it
          // never does.
          recyclingKey={photoUrl}
        />
      ) : null}

      {photoUrl ? null : (
        <>
          {/* A low sun, sitting behind the towers. */}
          <View
            style={{
              position: "absolute",
              right: "18%",
              bottom: height * 0.3,
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor:
                tint === "dusk"
                  ? "rgba(255,226,160,0.6)"
                  : "rgba(226,236,255,0.13)",
            }}
          />

          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: height * 0.82,
              flexDirection: "row",
              alignItems: "flex-end",
            }}
          >
            {towers.map((tower, index) => (
              <View
                key={index}
                style={{
                  width: tower.width,
                  height: `${tower.height * 100}%`,
                  marginRight: tower.gap,
                  backgroundColor: silhouette,
                  opacity: 0.92,
                  paddingTop: 7,
                  paddingHorizontal: 4,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignContent: "flex-start",
                  gap: 3,
                }}
              >
                {tower.windows.map((lit, windowIndex) => (
                  <View
                    key={windowIndex}
                    style={{
                      width: 3,
                      height: 4,
                      backgroundColor: lit
                        ? "rgba(250,166,26,0.75)"
                        : "rgba(255,255,255,0.05)",
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const StyleSheetAbsolute = {
  position: "absolute" as const,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};
