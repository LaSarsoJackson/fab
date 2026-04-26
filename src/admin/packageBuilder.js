import { buildGeneratedArtifacts } from "./derivatives";
import { materializeSnapshotForExport, serializeSnapshotToFeatureCollection } from "./geoJsonData";
import { DATA_MODULES } from "../features/fab/profile";

const affectsDerivedArtifacts = (dirtyModuleIds) => (
  Array.from(dirtyModuleIds).some((moduleId) => (
    moduleId === "burials" ||
    moduleId === "boundary" ||
    moduleId.startsWith("tour:")
  ))
);

export const buildUpdateBundle = async ({ getSnapshot, dirtyModuleIds }) => {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const serializedModulesById = {};
  const includedFiles = [];

  for (const moduleDefinition of DATA_MODULES) {
    const snapshot = await getSnapshot(moduleDefinition.id);
    const materializedSnapshot = materializeSnapshotForExport(snapshot);
    const serialized = serializeSnapshotToFeatureCollection(materializedSnapshot);

    serializedModulesById[moduleDefinition.id] = serialized;

    if (dirtyModuleIds.has(moduleDefinition.id)) {
      zip.file(moduleDefinition.sourcePath, JSON.stringify(serialized, null, 2));
      includedFiles.push(moduleDefinition.sourcePath);
    }
  }

  if (affectsDerivedArtifacts(dirtyModuleIds)) {
    const generatedArtifacts = buildGeneratedArtifacts(serializedModulesById);
    generatedArtifacts.forEach((artifact) => {
      zip.file(artifact.path, artifact.contents);
      includedFiles.push(artifact.path);
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    dirtyModules: Array.from(dirtyModuleIds),
    includedFiles,
    note: "This package is intended for review and publishing. Apply the listed files, then run the normal build and publish workflow.",
  };

  zip.file("admin-update-manifest.json", JSON.stringify(manifest, null, 2));

  const buffer = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    buffer,
    includedFiles,
  };
};
