import {
  buildEmptyRow,
  createRowLookup,
  extendSnapshotSchema,
  getAdminRowIdField,
  getImportableColumns,
  replaceSnapshotRows,
} from "./geoJsonData";

const isBlankCellValue = (value) => (
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "")
);

const isRowEmpty = (row = {}) => (
  Object.values(row).every((value) => isBlankCellValue(value))
);

const loadXlsx = async () => import("xlsx");

const buildSchemaSheetRows = (snapshot, moduleDefinition) => (
  snapshot.schema.map((field) => ({
    field: field.key,
    label: field.label,
    type: field.type,
    group: field.group,
    editable: field.readOnly ? "No" : "Yes",
    hidden_in_grid: field.hidden ? "Yes" : "No",
    source_file: moduleDefinition.sourcePath,
  }))
);

const buildInstructionsSheetRows = (snapshot, moduleDefinition) => ([
  {
    item: "Dataset",
    value: moduleDefinition.label,
  },
  {
    item: "Source file",
    value: moduleDefinition.sourcePath,
  },
  {
    item: "How to update",
    value: "Edit rows in the data sheet, then import the workbook back into the admin studio.",
  },
  {
    item: "Internal row ID",
    value: `Do not delete the ${getAdminRowIdField()} column. It lets the admin tool merge workbook edits back into the right feature.`,
  },
  {
    item: "Publishing",
    value: "After reviewing edits in the admin studio, download the updated source JSON or update bundle and promote those files through the normal static deploy flow.",
  },
  {
    item: "Geometry",
    value: snapshot.geometryMode === "point"
      ? "Point layers use longitude and latitude columns."
      : "Non-point layers use the geometry_json column with full GeoJSON geometry.",
  },
]);

export const exportSnapshotToWorkbook = async (snapshot, moduleDefinition) => {
  const XLSX = await loadXlsx();
  const workbook = XLSX.utils.book_new();
  const columns = getImportableColumns(snapshot);
  const dataRows = snapshot.rows.map((row) => {
    const outputRow = {};
    columns.forEach((column) => {
      outputRow[column] = row[column] ?? "";
    });
    return outputRow;
  });

  const dataSheet = XLSX.utils.json_to_sheet(dataRows, { header: columns });
  const schemaSheet = XLSX.utils.json_to_sheet(buildSchemaSheetRows(snapshot, moduleDefinition));
  const instructionsSheet = XLSX.utils.json_to_sheet(buildInstructionsSheetRows(snapshot, moduleDefinition));

  XLSX.utils.book_append_sheet(workbook, dataSheet, "data");
  XLSX.utils.book_append_sheet(workbook, schemaSheet, "schema");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, "instructions");

  return XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  });
};

export const parseWorkbookFile = async (file) => {
  const XLSX = await loadXlsx();
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: false,
  });
  const targetSheetName = workbook.SheetNames.includes("data")
    ? "data"
    : workbook.SheetNames[0];
  const sheet = workbook.Sheets[targetSheetName];

  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false,
  });
};

export const mergeImportedRows = (snapshot, importedRows) => {
  let nextSnapshot = snapshot;
  const nextRows = [...snapshot.rows];
  const adminRowIdField = getAdminRowIdField();
  const currentLookup = createRowLookup(nextRows);
  const primaryKeyLookup = new Map();

  if (snapshot.primaryKey) {
    nextRows.forEach((row) => {
      const key = row[snapshot.primaryKey];
      if (isBlankCellValue(key)) return;
      primaryKeyLookup.set(String(key), row[adminRowIdField]);
    });
  }

  importedRows.forEach((rawRow) => {
    if (isRowEmpty(rawRow)) return;

    nextSnapshot = extendSnapshotSchema(nextSnapshot, rawRow);

    const explicitRowId = rawRow[adminRowIdField];
    const primaryKeyValue = snapshot.primaryKey ? rawRow[snapshot.primaryKey] : "";
    const resolvedRowId =
      (explicitRowId && currentLookup.has(explicitRowId) && explicitRowId) ||
      (!isBlankCellValue(primaryKeyValue) && primaryKeyLookup.get(String(primaryKeyValue))) ||
      null;

    if (resolvedRowId) {
      const existingRow = currentLookup.get(resolvedRowId);
      const mergedRow = {
        ...existingRow,
        ...rawRow,
        [adminRowIdField]: resolvedRowId,
      };
      const rowIndex = nextRows.findIndex((row) => row[adminRowIdField] === resolvedRowId);
      nextRows[rowIndex] = mergedRow;
      currentLookup.set(resolvedRowId, mergedRow);
      return;
    }

    const blankRow = buildEmptyRow(nextSnapshot);
    const newRow = {
      ...blankRow,
      ...rawRow,
      [adminRowIdField]: blankRow[adminRowIdField],
    };
    nextRows.push(newRow);
    currentLookup.set(newRow[adminRowIdField], newRow);

    if (snapshot.primaryKey && !isBlankCellValue(newRow[snapshot.primaryKey])) {
      primaryKeyLookup.set(String(newRow[snapshot.primaryKey]), newRow[adminRowIdField]);
    }
  });

  return replaceSnapshotRows(nextSnapshot, nextRows);
};
