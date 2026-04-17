const ADMIN_ROW_ID_FIELD = "__admin_row_id";
const FEATURE_INDEX_FIELD = "__feature_index";
const GEOMETRY_TYPE_FIELD = "__geometry_type";
const GEOMETRY_JSON_FIELD = "geometry_json";
const LONGITUDE_FIELD = "longitude";
const LATITUDE_FIELD = "latitude";

const INTERNAL_FIELDS = new Set([
  ADMIN_ROW_ID_FIELD,
  FEATURE_INDEX_FIELD,
  GEOMETRY_TYPE_FIELD,
]);

const DEFAULT_PRIMARY_KEY_CANDIDATES = [
  "OBJECTID",
  "Tour_ID",
  "SSorder",
  "RecordID",
  "ARC_GeoID",
  "id",
];

const cleanText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const isBlankValue = (value) => (
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "")
);

const isNumericString = (value) => (
  typeof value === "string" &&
  value.trim() !== "" &&
  /^-?\d+(\.\d+)?$/.test(value.trim())
);

const inferFieldType = (values = []) => {
  const meaningfulValues = values.filter((value) => !isBlankValue(value));
  if (!meaningfulValues.length) return "string";

  if (meaningfulValues.every((value) => typeof value === "boolean")) {
    return "boolean";
  }

  if (meaningfulValues.every((value) => typeof value === "number")) {
    return "number";
  }

  if (meaningfulValues.every((value) => Array.isArray(value) || (value && typeof value === "object"))) {
    return "json";
  }

  return "string";
};

const rankField = (field) => {
  const preferredOrder = [
    "OBJECTID",
    "Tour_ID",
    "SSorder",
    "First_Name",
    "Last_Name",
    "Full_Name",
    "Section",
    "Lot",
    "Tier",
    "Grave",
    "Birth",
    "Death",
    "Titles",
  ];
  const index = preferredOrder.indexOf(field);
  return index === -1 ? preferredOrder.length + 1 : index;
};

const compareFieldNames = (left, right) => {
  const rankDifference = rankField(left) - rankField(right);
  if (rankDifference !== 0) return rankDifference;
  return left.localeCompare(right);
};

const detectPrimaryKey = (features = []) => {
  for (const candidate of DEFAULT_PRIMARY_KEY_CANDIDATES) {
    const allHaveCandidate = features.every((feature, index) => {
      const value = feature?.properties?.[candidate];
      return !isBlankValue(value) || (candidate === "id" && !isBlankValue(feature?.id));
    });

    const values = features.map((feature) => {
      if (candidate === "id" && !isBlankValue(feature?.id)) return feature.id;
      return feature?.properties?.[candidate];
    });
    const uniqueValues = new Set(values.filter((value) => !isBlankValue(value)).map((value) => String(value)));

    if (allHaveCandidate && uniqueValues.size === features.length) {
      return candidate;
    }
  }

  return null;
};

const detectGeometryMode = (features = []) => {
  const nonNullGeometryTypes = Array.from(
    new Set(
      features
        .map((feature) => feature?.geometry?.type || "")
        .filter(Boolean)
    )
  );

  if (nonNullGeometryTypes.length === 0 || nonNullGeometryTypes.every((type) => type === "Point")) {
    return "point";
  }

  return "geojson";
};

const normalizeGeometryString = (geometry) => {
  if (!geometry) return "";
  return JSON.stringify(geometry, null, 2);
};

const buildRowId = (moduleId, feature, index, primaryKey) => {
  if (primaryKey === "id" && !isBlankValue(feature?.id)) {
    return `${moduleId}:${primaryKey}:${feature.id}`;
  }

  if (primaryKey && !isBlankValue(feature?.properties?.[primaryKey])) {
    return `${moduleId}:${primaryKey}:${feature.properties[primaryKey]}`;
  }

  return `${moduleId}:feature:${index}`;
};

const coerceValue = (value, type) => {
  if (isBlankValue(value)) {
    return type === "string" ? "" : null;
  }

  if (type === "number") {
    if (typeof value === "number") return value;
    if (isNumericString(value)) return Number(value);
    return value;
  }

  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    return Boolean(value);
  }

  if (type === "json") {
    if (typeof value === "string") {
      return value.trim() ? JSON.parse(value) : null;
    }
    return value;
  }

  return value;
};

export const buildModuleSnapshot = (moduleDefinition, featureCollection) => {
  const features = Array.isArray(featureCollection?.features) ? featureCollection.features : [];
  const geometryMode = detectGeometryMode(features);
  const primaryKey = detectPrimaryKey(features);
  const propertyValues = new Map();

  features.forEach((feature) => {
    Object.entries(feature?.properties || {}).forEach(([key, value]) => {
      if (!propertyValues.has(key)) {
        propertyValues.set(key, []);
      }
      propertyValues.get(key).push(value);
    });
  });

  const propertyFields = Array.from(propertyValues.keys())
    .sort(compareFieldNames)
    .map((key) => ({
      key,
      label: key,
      type: inferFieldType(propertyValues.get(key)),
      group: "properties",
    }));

  const schema = [
    {
      key: ADMIN_ROW_ID_FIELD,
      label: "Admin row ID",
      type: "string",
      group: "system",
      hidden: true,
      readOnly: true,
    },
    {
      key: FEATURE_INDEX_FIELD,
      label: "Feature index",
      type: "number",
      group: "system",
      hidden: true,
      readOnly: true,
    },
    {
      key: GEOMETRY_TYPE_FIELD,
      label: "Geometry type",
      type: "string",
      group: "system",
      hidden: false,
      readOnly: geometryMode === "point",
    },
    ...propertyFields,
    ...(geometryMode === "point"
      ? [
          { key: LONGITUDE_FIELD, label: "Longitude", type: "number", group: "geometry" },
          { key: LATITUDE_FIELD, label: "Latitude", type: "number", group: "geometry" },
        ]
      : [
          { key: GEOMETRY_JSON_FIELD, label: "Geometry JSON", type: "json_text", group: "geometry" },
        ]),
  ];

  const rows = features.map((feature, index) => {
    const properties = feature?.properties || {};
    const geometryType = feature?.geometry?.type || "";
    const row = {
      [ADMIN_ROW_ID_FIELD]: buildRowId(moduleDefinition.id, feature, index, primaryKey),
      [FEATURE_INDEX_FIELD]: index,
      [GEOMETRY_TYPE_FIELD]: geometryType,
    };

    propertyFields.forEach(({ key }) => {
      row[key] = properties[key] ?? "";
    });

    if (geometryMode === "point") {
      row[LONGITUDE_FIELD] = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates[0] : "";
      row[LATITUDE_FIELD] = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates[1] : "";
    } else {
      row[GEOMETRY_JSON_FIELD] = normalizeGeometryString(feature?.geometry);
    }

    return row;
  });

  return {
    moduleId: moduleDefinition.id,
    geometryMode,
    primaryKey,
    schema,
    rows,
    topLevel: {
      type: featureCollection?.type || "FeatureCollection",
      ...Object.fromEntries(
        Object.entries(featureCollection || {}).filter(([key]) => key !== "features")
      ),
    },
  };
};

export const buildEmptyRow = (snapshot) => {
  const row = {
    [ADMIN_ROW_ID_FIELD]: `${snapshot.moduleId}:draft:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    [FEATURE_INDEX_FIELD]: snapshot.rows.length,
    [GEOMETRY_TYPE_FIELD]: snapshot.geometryMode === "point" ? "Point" : "",
  };

  snapshot.schema.forEach((field) => {
    if (field.key in row) return;

    if (field.key === GEOMETRY_JSON_FIELD) {
      row[field.key] = "";
      return;
    }

    row[field.key] = "";
  });

  return row;
};

export const getSchemaField = (snapshot, key) => (
  snapshot.schema.find((field) => field.key === key) || null
);

export const extendSnapshotSchema = (snapshot, row) => {
  const missingKeys = Object.keys(row).filter((key) => !getSchemaField(snapshot, key));
  if (!missingKeys.length) return snapshot;

  const additionalFields = missingKeys
    .filter((key) => !INTERNAL_FIELDS.has(key))
    .sort(compareFieldNames)
    .map((key) => ({
      key,
      label: key,
      type: inferFieldType([row[key]]),
      group: "properties",
    }));

  if (!additionalFields.length) return snapshot;

  const systemFields = snapshot.schema.filter((field) => field.group === "system");
  const propertyFields = snapshot.schema.filter((field) => field.group === "properties");
  const geometryFields = snapshot.schema.filter((field) => field.group === "geometry");

  return {
    ...snapshot,
    schema: [
      ...systemFields,
      ...propertyFields,
      ...additionalFields,
      ...geometryFields,
    ],
  };
};

export const replaceSnapshotRows = (snapshot, nextRows) => ({
  ...snapshot,
  rows: nextRows,
});

export const materializeSnapshotForExport = (snapshot) => {
  if (!snapshot.primaryKey) return snapshot;

  const primaryKeyField = getSchemaField(snapshot, snapshot.primaryKey);
  if (!primaryKeyField) return snapshot;

  const existingValues = snapshot.rows
    .map((row) => row[snapshot.primaryKey])
    .filter((value) => !isBlankValue(value) && (typeof value === "number" || isNumericString(value)))
    .map((value) => Number(value));

  let nextValue = existingValues.length ? Math.max(...existingValues) + 1 : 1;
  const nextRows = snapshot.rows.map((row) => {
    if (!isBlankValue(row[snapshot.primaryKey])) {
      return row;
    }

    if (primaryKeyField.type !== "number" && primaryKeyField.type !== "string") {
      return row;
    }

    const assignedValue = primaryKeyField.type === "number" ? nextValue : String(nextValue);
    nextValue += 1;

    return {
      ...row,
      [snapshot.primaryKey]: assignedValue,
    };
  });

  return {
    ...snapshot,
    rows: nextRows,
  };
};

export const serializeSnapshotToFeatureCollection = (snapshot) => {
  const propertyFields = snapshot.schema.filter((field) => field.group === "properties");

  const features = snapshot.rows.map((row, index) => {
    const properties = {};

    propertyFields.forEach((field) => {
      properties[field.key] = coerceValue(row[field.key], field.type);
    });

    let geometry = null;
    if (snapshot.geometryMode === "point") {
      const longitude = coerceValue(row[LONGITUDE_FIELD], "number");
      const latitude = coerceValue(row[LATITUDE_FIELD], "number");

      geometry = !isBlankValue(longitude) && !isBlankValue(latitude)
        ? {
            type: "Point",
            coordinates: [Number(longitude), Number(latitude)],
          }
        : null;
    } else if (cleanText(row[GEOMETRY_JSON_FIELD])) {
      geometry = JSON.parse(row[GEOMETRY_JSON_FIELD]);
    }

    return {
      type: "Feature",
      properties,
      geometry,
      ...(snapshot.primaryKey === "id" && !isBlankValue(row.id) ? { id: row.id } : {}),
    };
  });

  return {
    ...snapshot.topLevel,
    type: snapshot.topLevel?.type || "FeatureCollection",
    features,
  };
};

export const createRowLookup = (rows = []) => {
  const lookup = new Map();
  rows.forEach((row) => {
    lookup.set(row[ADMIN_ROW_ID_FIELD], row);
  });
  return lookup;
};

export const buildSearchableText = (row = {}, keys = []) => (
  keys.map((key) => cleanText(row[key])).filter(Boolean).join(" ").toLowerCase()
);

export const getExportColumns = (snapshot) => (
  snapshot.schema.filter((field) => !field.hidden).map((field) => field.key)
);

export const getImportableColumns = (snapshot) => (
  snapshot.schema.map((field) => field.key)
);

export const getAdminRowIdField = () => ADMIN_ROW_ID_FIELD;

export const getGeometryFieldKeys = () => ({
  geometryJson: GEOMETRY_JSON_FIELD,
  longitude: LONGITUDE_FIELD,
  latitude: LATITUDE_FIELD,
  geometryType: GEOMETRY_TYPE_FIELD,
});
