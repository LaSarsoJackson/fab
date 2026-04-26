import { loadDataModule } from "../features/fab/profile";
import {
  buildModuleSnapshot,
  extendSnapshotSchema,
  getAdminRowIdField,
  getGeometryFieldKeys,
  replaceSnapshotRows,
} from "./geoJsonData";

const SEARCHABLE_FIELD_PRIORITY = [
  "First_Name",
  "Last_Name",
  "Full_Name",
  "Section",
  "Lot",
  "Tier",
  "Grave",
  "Titles",
  "Tour_Bio",
  "ARC_GeoID",
];

const geometryFieldKeys = getGeometryFieldKeys();
const adminRowIdField = getAdminRowIdField();

export const getGridColumns = (snapshot) => (
  snapshot.schema
    .filter((field) => !field.hidden)
    .filter((field) => field.key !== geometryFieldKeys.geometryJson)
    .map((field) => ({
      field: field.key,
      headerName: field.label,
      flex: field.key === geometryFieldKeys.geometryType ? 0.8 : 1,
      minWidth: field.key === geometryFieldKeys.geometryType ? 130 : 160,
      sortable: true,
      editable: false,
      valueGetter: (params) => params.row[field.key],
    }))
);

export const getSearchKeys = (snapshot) => {
  const propertyFields = snapshot.schema
    .filter((field) => field.group === "properties")
    .map((field) => field.key);
  const prioritized = SEARCHABLE_FIELD_PRIORITY.filter((field) => propertyFields.includes(field));
  const fallback = propertyFields.filter((field) => !prioritized.includes(field)).slice(0, 8);

  return [...prioritized, ...fallback];
};

export const formatModuleCount = (snapshot) => (
  snapshot ? `${snapshot.rows.length.toLocaleString()} records` : "Not loaded"
);

export const updateSetMembership = (previous, moduleId, shouldInclude) => {
  const next = new Set(previous);

  if (shouldInclude) {
    next.add(moduleId);
  } else {
    next.delete(moduleId);
  }

  return next;
};

export const loadModuleSnapshot = async (moduleDefinition) => {
  const loadedData = await loadDataModule(moduleDefinition);
  return buildModuleSnapshot(moduleDefinition, loadedData);
};

export const upsertDraftSnapshot = (snapshot, draftRow) => {
  const nextSnapshot = extendSnapshotSchema(snapshot, draftRow);
  const existingIndex = nextSnapshot.rows.findIndex(
    (row) => row[adminRowIdField] === draftRow[adminRowIdField]
  );
  const nextRows = [...nextSnapshot.rows];

  if (existingIndex >= 0) {
    nextRows[existingIndex] = {
      ...nextRows[existingIndex],
      ...draftRow,
    };
  } else {
    nextRows.push(draftRow);
  }

  return replaceSnapshotRows(nextSnapshot, nextRows);
};

export const groupModulesByGroup = (moduleDefinitions) => (
  moduleDefinitions.reduce((groups, moduleDefinition) => {
    if (!groups[moduleDefinition.group]) {
      groups[moduleDefinition.group] = [];
    }

    groups[moduleDefinition.group].push(moduleDefinition);
    return groups;
  }, {})
);
