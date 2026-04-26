#!/usr/bin/env python3

"""
Read a GeoParquet file and emit GeoJSON to stdout.

This stays out of the main runtime path. It exists so the build pipeline can
prefer GeoParquet when it is available while falling back to the checked-in
GeoJSON source if Python geospatial dependencies are not installed.
"""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: read_geoparquet.py <input.parquet>", file=sys.stderr)
        return 1

    input_path = Path(sys.argv[1]).expanduser().resolve()
    if not input_path.exists():
        print(f"GeoParquet source not found: {input_path}", file=sys.stderr)
        return 1

    try:
        import geopandas as gpd
    except Exception as error:  # pragma: no cover - dependency availability
        print(
            "geopandas with pyarrow/shapely support is required to read GeoParquet "
            f"({error})",
            file=sys.stderr,
        )
        return 2

    dataframe = gpd.read_parquet(input_path)
    sys.stdout.write(dataframe.to_json(drop_id=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
