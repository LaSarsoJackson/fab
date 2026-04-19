import React, { Suspense, lazy } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import MapIcon from "@mui/icons-material/Map";

import { isAdminStudioEnabled } from "./shared/runtime";

const AdminApp = lazy(() => import("./AdminApp"));

const returnToMap = () => {
  if (typeof window === "undefined") return;
  window.location.hash = "";
};

const AdminShell = ({ children }) => (
  <Box
    sx={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #f5f1e8 0%, #efe9dc 100%)",
      color: "#18231d",
      p: { xs: 2, md: 3 },
      display: "grid",
      placeItems: "center",
    }}
  >
    <Paper
      elevation={0}
      sx={{
        width: "min(100%, 640px)",
        borderRadius: 3,
        p: { xs: 2.5, md: 3.5 },
        border: "1px solid rgba(24, 35, 29, 0.08)",
        background: "rgba(255, 252, 246, 0.98)",
      }}
    >
      {children}
    </Paper>
  </Box>
);

export default function AdminRoute() {
  if (!isAdminStudioEnabled()) {
    return (
      <AdminShell>
        <Stack spacing={2.5}>
          <Stack spacing={1}>
            <Typography variant="overline" sx={{ letterSpacing: "0.16em", color: "#5a6a5e" }}>
              Admin Studio
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Admin studio is only available in development
            </Typography>
            <Typography variant="body1" sx={{ color: "#425348" }}>
              This static editing workspace is intentionally hidden from production builds.
            </Typography>
          </Stack>

          <Alert severity="info">
            Use the existing development environment flag to open `#/admin` locally. Production builds fall back
            to the public map experience instead of exposing the admin route.
          </Alert>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
            <Button
              variant="outlined"
              startIcon={<MapIcon />}
              onClick={returnToMap}
            >
              Return To Map
            </Button>
          </Stack>
        </Stack>
      </AdminShell>
    );
  }

  return (
    <Suspense
      fallback={(
        <AdminShell>
          <Stack spacing={2} alignItems="flex-start">
            <Typography variant="overline" sx={{ letterSpacing: "0.16em", color: "#5a6a5e" }}>
              Development Admin Studio
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Loading development admin tools
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body1" sx={{ color: "#425348" }}>
                Opening the file-backed editor for local development.
              </Typography>
            </Stack>
          </Stack>
        </AdminShell>
      )}
    >
      <AdminApp />
    </Suspense>
  );
}
