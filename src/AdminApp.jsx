import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import ArchiveIcon from "@mui/icons-material/Archive";
import AddIcon from "@mui/icons-material/Add";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import MapIcon from "@mui/icons-material/Map";
import { DataGrid } from "@mui/x-data-grid";

import { exportSnapshotToWorkbook, mergeImportedRows, parseWorkbookFile } from "./admin/excel";
import {
  buildEmptyRow,
  buildSearchableText,
  getAdminRowIdField,
  getGeometryFieldKeys,
  materializeSnapshotForExport,
  serializeSnapshotToFeatureCollection,
} from "./admin/geoJsonData";
import { DATA_MODULES, getDataModule } from "./features/fab/profile";
import { buildUpdateBundle } from "./admin/packageBuilder";
import {
  formatModuleCount,
  getGridColumns,
  getSearchKeys,
  groupModulesByGroup,
  loadModuleSnapshot,
  updateSetMembership,
  upsertDraftSnapshot,
} from "./admin/adminAppState";
import { APP_ROUTE_IDS, isAdminHash, navigateToAppRoute } from "./shared/routing";

const PAGE_SIZE = 50;

const geometryFieldKeys = getGeometryFieldKeys();
const adminRowIdField = getAdminRowIdField();

const triggerDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

const downloadJsonFile = (fileName, value) => {
  triggerDownload(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    fileName
  );
};

const downloadArrayBuffer = (fileName, buffer, mimeType) => {
  triggerDownload(
    new Blob([buffer], { type: mimeType }),
    fileName
  );
};

export default function AdminApp() {
  const fileInputRef = useRef(null);
  const [selectedModuleId, setSelectedModuleId] = useState(DATA_MODULES[0]?.id || "");
  const [moduleSnapshots, setModuleSnapshots] = useState({});
  const [loadingModuleIds, setLoadingModuleIds] = useState(() => new Set());
  const [dirtyModuleIds, setDirtyModuleIds] = useState(() => new Set());
  const [searchText, setSearchText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeDraft, setActiveDraft] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const selectedModule = useMemo(
    () => getDataModule(selectedModuleId),
    [selectedModuleId]
  );
  const setModuleLoading = useCallback((moduleId, isLoading) => {
    setLoadingModuleIds((previous) => updateSetMembership(previous, moduleId, isLoading));
  }, []);
  const setModuleDirty = useCallback((moduleId, isDirty) => {
    setDirtyModuleIds((previous) => updateSetMembership(previous, moduleId, isDirty));
  }, []);

  const ensureSnapshot = useCallback(async (moduleId) => {
    const existingSnapshot = moduleSnapshots[moduleId];
    if (existingSnapshot) {
      return existingSnapshot;
    }

    const moduleDefinition = getDataModule(moduleId);
    if (!moduleDefinition) {
      throw new Error(`Unknown module: ${moduleId}`);
    }

    setModuleLoading(moduleId, true);

    try {
      const snapshot = await loadModuleSnapshot(moduleDefinition);

      setModuleSnapshots((previous) => ({
        ...previous,
        [moduleId]: snapshot,
      }));

      return snapshot;
    } finally {
      setModuleLoading(moduleId, false);
    }
  }, [moduleSnapshots, setModuleLoading]);

  useEffect(() => {
    if (!selectedModuleId) return;
    void ensureSnapshot(selectedModuleId);
  }, [ensureSnapshot, selectedModuleId]);

  const selectedSnapshot = moduleSnapshots[selectedModuleId] || null;
  const isSelectedModuleLoading = loadingModuleIds.has(selectedModuleId);
  const searchKeys = useMemo(
    () => (selectedSnapshot ? getSearchKeys(selectedSnapshot) : []),
    [selectedSnapshot]
  );

  const filteredRows = useMemo(() => {
    if (!selectedSnapshot) return [];
    const normalizedQuery = searchText.trim().toLowerCase();
    if (!normalizedQuery) return selectedSnapshot.rows;

    return selectedSnapshot.rows.filter((row) => (
      buildSearchableText(row, searchKeys).includes(normalizedQuery)
    ));
  }, [searchKeys, searchText, selectedSnapshot]);

  const gridColumns = useMemo(
    () => (selectedSnapshot ? getGridColumns(selectedSnapshot) : []),
    [selectedSnapshot]
  );

  const setSnapshot = useCallback((moduleId, snapshot, { dirty = null } = {}) => {
    setModuleSnapshots((previous) => ({
      ...previous,
      [moduleId]: snapshot,
    }));

    if (dirty !== null) {
      setModuleDirty(moduleId, dirty);
    }
  }, [setModuleDirty]);

  const openEditor = useCallback((row = null) => {
    if (!selectedSnapshot) return;

    setActiveDraft(row ? { ...row } : buildEmptyRow(selectedSnapshot));
    setIsEditorOpen(true);
  }, [selectedSnapshot]);

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false);
    setActiveDraft(null);
  }, []);

  const handleDraftFieldChange = useCallback((field, value) => {
    setActiveDraft((previous) => ({
      ...previous,
      [field]: value,
    }));
  }, []);

  const handleSaveDraft = useCallback(() => {
    if (!selectedSnapshot || !activeDraft) return;

    setSnapshot(selectedModuleId, upsertDraftSnapshot(selectedSnapshot, activeDraft), { dirty: true });
    setFeedback(`${selectedModule?.label || "Dataset"} updated in the current draft.`);
    closeEditor();
  }, [activeDraft, closeEditor, selectedModule?.label, selectedModuleId, selectedSnapshot, setSnapshot]);

  const handleImportWorkbook = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedSnapshot || !selectedModule) return;

    setIsBusy(true);
    setErrorMessage("");

    try {
      const importedRows = await parseWorkbookFile(file);
      const mergedSnapshot = mergeImportedRows(selectedSnapshot, importedRows);
      setSnapshot(selectedModuleId, mergedSnapshot, { dirty: true });
      setFeedback(`${importedRows.length.toLocaleString()} workbook rows merged into ${selectedModule.label}.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(`Workbook import failed: ${error.message}`);
    } finally {
      event.target.value = "";
      setIsBusy(false);
    }
  }, [selectedModule, selectedModuleId, selectedSnapshot, setSnapshot]);

  const handleDownloadWorkbook = useCallback(async () => {
    if (!selectedSnapshot || !selectedModule) return;

    setIsBusy(true);
    setErrorMessage("");

    try {
      const materializedSnapshot = materializeSnapshotForExport(selectedSnapshot);
      const workbookBuffer = await exportSnapshotToWorkbook(materializedSnapshot, selectedModule);
      downloadArrayBuffer(
        `${selectedModule.fileName.replace(/\.json$/i, "")}.xlsx`,
        workbookBuffer,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      setFeedback(`Excel workbook exported for ${selectedModule.label}.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(`Workbook export failed: ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  }, [selectedModule, selectedSnapshot]);

  const handleDownloadModuleJson = useCallback(() => {
    if (!selectedSnapshot || !selectedModule) return;

    try {
      const serialized = serializeSnapshotToFeatureCollection(materializeSnapshotForExport(selectedSnapshot));
      downloadJsonFile(selectedModule.fileName, serialized);
      setFeedback(`${selectedModule.fileName} downloaded.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(`Dataset export failed: ${error.message}`);
    }
  }, [selectedModule, selectedSnapshot]);

  const handleDownloadUpdateBundle = useCallback(async () => {
    if (dirtyModuleIds.size === 0) {
      setFeedback("No draft changes are waiting to export.");
      return;
    }

    setIsBusy(true);
    setErrorMessage("");

    try {
      const { buffer, includedFiles } = await buildUpdateBundle({
        dirtyModuleIds,
        getSnapshot: ensureSnapshot,
      });
      downloadArrayBuffer(
        "fab-admin-update.zip",
        buffer,
        "application/zip"
      );
      setFeedback(`${includedFiles.length} updated file${includedFiles.length === 1 ? "" : "s"} added to the review package.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(`Review package export failed: ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  }, [dirtyModuleIds, ensureSnapshot]);

  const handleResetModule = useCallback(async () => {
    if (!selectedModule) return;

    setIsBusy(true);
    setErrorMessage("");

    try {
      const snapshot = await loadModuleSnapshot(selectedModule);
      setSnapshot(selectedModuleId, snapshot, { dirty: false });
      setFeedback(`${selectedModule.label} reset to the saved copy.`);
    } catch (error) {
      console.error(error);
      setErrorMessage(`Reset failed: ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  }, [selectedModule, selectedModuleId, setSnapshot]);

  const groupedModules = useMemo(() => groupModulesByGroup(DATA_MODULES), []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f5f1e8 0%, #efe9dc 100%)",
        color: "#18231d",
        p: { xs: 2, md: 3 },
      }}
    >
      <Stack spacing={2.5}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 3,
            p: { xs: 2, md: 3 },
            border: "1px solid rgba(24, 35, 29, 0.08)",
            background: "rgba(255, 252, 246, 0.96)",
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Box>
              <Typography variant="overline" sx={{ letterSpacing: "0.16em", color: "#5a6a5e" }}>
                Records Workspace
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
                Edit cemetery records
              </Typography>
              <Typography variant="body1" sx={{ maxWidth: 860, color: "#425348" }}>
                Review changes here, then export a review package for the publishing workflow.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }}>
              <Chip label="Draft workspace" color="warning" variant="outlined" />
              <Chip
                label={`${dirtyModuleIds.size} changed dataset${dirtyModuleIds.size === 1 ? "" : "s"}`}
                color={dirtyModuleIds.size > 0 ? "warning" : "default"}
                variant={dirtyModuleIds.size > 0 ? "filled" : "outlined"}
              />
              <Button
                variant="outlined"
                startIcon={<MapIcon />}
                onClick={() => navigateToAppRoute(APP_ROUTE_IDS.map)}
              >
                Return to map
              </Button>
              <Button
                variant="contained"
                startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <ArchiveIcon />}
                onClick={handleDownloadUpdateBundle}
                disabled={isBusy}
              >
                Download review package
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {feedback && (
          <Alert severity="success" onClose={() => setFeedback("")}>
            {feedback}
          </Alert>
        )}

        {errorMessage && (
          <Alert severity="error" onClose={() => setErrorMessage("")}>
            {errorMessage}
          </Alert>
        )}

        <Box
          sx={{
            display: "grid",
            gap: 2.5,
            gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
            alignItems: "start",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid rgba(24, 35, 29, 0.08)",
              background: "rgba(255, 252, 246, 0.98)",
              overflow: "hidden",
            }}
          >
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Editable datasets
              </Typography>
              <Typography variant="body2" sx={{ color: "#55655a" }}>
                Burial records, map layers, and tours available for review.
              </Typography>
            </Box>
            <Divider />
            <List disablePadding>
              {Object.entries(groupedModules).map(([groupName, modules]) => (
                <Box key={groupName}>
                  <Box sx={{ px: 2, py: 1.5, bgcolor: "rgba(24, 35, 29, 0.04)" }}>
                    <Typography variant="overline" sx={{ letterSpacing: "0.14em", color: "#566559" }}>
                      {groupName}
                    </Typography>
                  </Box>
                  {modules.map((moduleDefinition) => {
                    const snapshot = moduleSnapshots[moduleDefinition.id];
                    const isDirty = dirtyModuleIds.has(moduleDefinition.id);

                    return (
                      <ListItemButton
                        key={moduleDefinition.id}
                        selected={moduleDefinition.id === selectedModuleId}
                        onClick={() => setSelectedModuleId(moduleDefinition.id)}
                        sx={{ alignItems: "flex-start", py: 1.5 }}
                      >
                        <ListItemText
                          primary={moduleDefinition.label}
                          secondary={
                            <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                              <Typography variant="body2" sx={{ color: "#55655a" }}>
                                {snapshot ? formatModuleCount(snapshot) : moduleDefinition.description}
                              </Typography>
                              <Stack direction="row" spacing={0.75} flexWrap="wrap">
                                <Chip size="small" label={moduleDefinition.group} variant="outlined" />
                                {isDirty && <Chip size="small" label="Draft changes" color="warning" />}
                              </Stack>
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    );
                  })}
                </Box>
              ))}
            </List>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              borderRadius: 3,
              border: "1px solid rgba(24, 35, 29, 0.08)",
              background: "rgba(255, 252, 246, 0.98)",
              overflow: "hidden",
            }}
          >
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      {selectedModule?.label || "Select a dataset"}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#55655a", mt: 0.5 }}>
                      {selectedModule?.description}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} flexWrap="wrap">
                      {selectedModule && <Chip size="small" label={selectedModule.group} variant="outlined" />}
                      {selectedSnapshot && <Chip size="small" label={formatModuleCount(selectedSnapshot)} />}
                      {dirtyModuleIds.has(selectedModuleId) && (
                        <Chip size="small" color="warning" label="Unexported draft changes" />
                      )}
                    </Stack>
                  </Box>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap">
                    <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openEditor()}>
                      Add Record
                    </Button>
                    <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>
                      Import Excel
                    </Button>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadWorkbook}>
                      Download Excel
                    </Button>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadModuleJson}>
                      Download dataset
                    </Button>
                    <Button variant="outlined" color="inherit" startIcon={<RestartAltIcon />} onClick={handleResetModule}>
                      Reset dataset
                    </Button>
                  </Stack>
                </Stack>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={handleImportWorkbook}
                />

                <TextField
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  label="Search current dataset"
                  placeholder="Search by name, section, lot, titles, IDs, and other common fields"
                  size="small"
                  fullWidth
                />

                {isSelectedModuleLoading || !selectedSnapshot ? (
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 8, justifyContent: "center" }}>
                    <CircularProgress size={26} />
                    <Typography variant="body1">Loading {selectedModule?.label || "dataset"}…</Typography>
                  </Stack>
                ) : (
                  <Box sx={{ height: 720, width: "100%" }}>
                    <DataGrid
                      rows={filteredRows}
                      columns={gridColumns}
                      getRowId={(row) => row[adminRowIdField]}
                      onRowClick={(params) => openEditor(params.row)}
                      pageSize={PAGE_SIZE}
                      rowsPerPageOptions={[25, 50, 100]}
                      disableSelectionOnClick
                      density="compact"
                      sx={{
                        border: "1px solid rgba(24, 35, 29, 0.08)",
                        backgroundColor: "#fffdfa",
                        "& .MuiDataGrid-columnHeaders": {
                          backgroundColor: "#f4efe4",
                        },
                      }}
                    />
                  </Box>
                )}
              </Stack>
            </Box>
          </Paper>
        </Box>
      </Stack>

      <Dialog
        open={isEditorOpen}
        onClose={closeEditor}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>{activeDraft?.[adminRowIdField] ? "Edit record" : "Add record"}</DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              gap: 2,
              pt: 0.5,
            }}
          >
            {selectedSnapshot?.schema.map((field) => {
              if (field.hidden && field.key !== adminRowIdField) {
                return null;
              }

              const isReadOnly = field.readOnly || field.key === adminRowIdField;
              const isLongField = field.key === geometryFieldKeys.geometryJson;
              const value = activeDraft?.[field.key] ?? "";

              return (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : value}
                  onChange={(event) => handleDraftFieldChange(field.key, event.target.value)}
                  type={field.type === "number" ? "number" : "text"}
                  multiline={isLongField}
                  minRows={isLongField ? 8 : 1}
                  fullWidth
                  InputProps={{ readOnly: isReadOnly }}
                  helperText={field.key === adminRowIdField ? "Internal merge key used for workbook re-imports." : ""}
                  sx={isLongField ? { gridColumn: { xs: "1 / -1", md: "1 / -1" } } : undefined}
                />
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditor}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveDraft}>
            Save Draft
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export { isAdminHash };
