export const PMTILES_EXPERIMENT_GLYPH_PALETTE = {
  approximate: {
    fill: "rgba(214, 155, 86, 0.28)",
    stroke: "rgba(124, 83, 40, 0.72)",
    guide: "rgba(124, 83, 40, 0.2)",
    label: "Approximate record point",
    detail: "Section and lot record without grave or tier placement metadata.",
  },
  indexed: {
    fill: "rgba(18, 94, 74, 0.28)",
    stroke: "rgba(15, 69, 54, 0.82)",
    guide: "rgba(15, 69, 54, 0.24)",
    label: "Indexed grave or tier record",
    detail: "Record includes grave or tier metadata, so it gets a stronger glyph.",
  },
};

const getNumericBurialProperty = (props, key) => {
  const numericValue = Number(props?.[key] ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const hasIndexedBurialPlacement = (props = {}) => (
  getNumericBurialProperty(props, "Grave") > 0 ||
  getNumericBurialProperty(props, "Tier") > 0
);

const getExperimentalBurialVisualKey = (props = {}) => String(
  props.OBJECTID ??
  props.objectid ??
  [
    props.Section,
    props.Lot,
    props.Grave,
    props.Tier,
    props.First_Name,
    props.Last_Name,
  ].join(":")
);

const hashExperimentalBurialKey = (value) => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const getPmtilesExperimentOffsetScale = (zoom) => {
  if (zoom >= 22) return 5.2;
  if (zoom >= 20) return 4.2;
  if (zoom >= 18) return 3.2;
  return 2.2;
};

export const getPmtilesExperimentGlyphSize = (zoom, isIndexed) => {
  if (zoom >= 22) return isIndexed ? 5.6 : 5;
  if (zoom >= 20) return isIndexed ? 5 : 4.5;
  if (zoom >= 18) return isIndexed ? 4.4 : 4;
  return isIndexed ? 3.9 : 3.5;
};

export const getPmtilesExperimentGlyphOffset = (zoom, props = {}, isIndexed) => {
  const grave = getNumericBurialProperty(props, "Grave");
  const tier = getNumericBurialProperty(props, "Tier");
  const hash = hashExperimentalBurialKey(getExperimentalBurialVisualKey(props));
  const offsetScale = getPmtilesExperimentOffsetScale(zoom);

  if (isIndexed) {
    const angle = (
      ((grave > 0 ? grave : hash % 24) % 16) / 16
    ) * Math.PI * 2 + ((hash % 7) * 0.07);
    const tierBand = tier > 0 ? Math.min(tier, 6) : ((hash % 4) + 1);
    const distance = Math.min(6, offsetScale * (0.72 + ((tierBand - 1) * 0.14)));
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
    };
  }

  const angle = ((hash % 24) / 24) * Math.PI * 2;
  const distance = offsetScale * (0.42 + ((hash % 5) * 0.08));
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
  };
};

const drawPmtilesExperimentGuide = (context, startX, startY, endX, endY, guideColor, zoom) => {
  const distance = Math.hypot(endX - startX, endY - startY);

  if (distance < 0.6) {
    return;
  }

  context.save();
  context.strokeStyle = guideColor;
  context.lineWidth = zoom >= 20 ? 1 : 0.8;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.stroke();
  context.restore();
};

const drawPmtilesExperimentCircleGlyph = (context, centerX, centerY, size, fillColor, strokeColor, zoom) => {
  context.save();
  context.fillStyle = fillColor;
  context.strokeStyle = strokeColor;
  context.lineWidth = zoom >= 20 ? 1.15 : 1;
  context.beginPath();
  context.arc(centerX, centerY, size, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
};

const drawPmtilesExperimentDiamondGlyph = (context, centerX, centerY, size, fillColor, strokeColor, zoom) => {
  context.save();
  context.fillStyle = fillColor;
  context.strokeStyle = strokeColor;
  context.lineWidth = zoom >= 20 ? 1.25 : 1.05;
  context.beginPath();
  context.moveTo(centerX, centerY - size);
  context.lineTo(centerX + size, centerY);
  context.lineTo(centerX, centerY + size);
  context.lineTo(centerX - size, centerY);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
};

export class ExperimentalBurialGlyphSymbolizer {
  constructor(variant) {
    this.variant = variant;
  }

  draw(context, geom, zoom, feature) {
    const anchor = geom?.[0]?.[0];
    if (!anchor) return;

    const props = feature?.props || {};
    const isIndexed = this.variant === "indexed";
    const palette = isIndexed
      ? PMTILES_EXPERIMENT_GLYPH_PALETTE.indexed
      : PMTILES_EXPERIMENT_GLYPH_PALETTE.approximate;
    const { dx, dy } = getPmtilesExperimentGlyphOffset(zoom, props, isIndexed);
    const centerX = anchor.x + dx;
    const centerY = anchor.y + dy;
    const size = getPmtilesExperimentGlyphSize(zoom, isIndexed);

    drawPmtilesExperimentGuide(
      context,
      anchor.x,
      anchor.y,
      centerX,
      centerY,
      palette.guide,
      zoom
    );

    if (isIndexed) {
      drawPmtilesExperimentDiamondGlyph(
        context,
        centerX,
        centerY,
        size,
        palette.fill,
        palette.stroke,
        zoom
      );
      return;
    }

    drawPmtilesExperimentCircleGlyph(
      context,
      centerX,
      centerY,
      size,
      palette.fill,
      palette.stroke,
      zoom
    );
  }
}
