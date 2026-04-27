#!/usr/bin/env python3

"""
Convert a GeoJSON source file into GeoParquet.

The output is intended to be a build-time artifact that can transparently feed
search-index generation and other static optimizations without changing the
user-facing map API.
"""

from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "Usage: geojson_to_geoparquet.py <input.geojson> <output.parquet>",
            file=sys.stderr,
        )
        return 1

    input_path = Path(sys.argv[1]).expanduser().resolve()
    output_path = Path(sys.argv[2]).expanduser().resolve()

    if not input_path.exists():
        print(f"GeoJSON source not found: {input_path}", file=sys.stderr)
        return 1

    try:
        import geopandas as gpd
    except Exception as error:  # pragma: no cover - dependency availability
        print(
            "geopandas with pyarrow/shapely support is required to generate GeoParquet "
            f"({error})",
            file=sys.stderr,
        )
        return 2

    output_path.parent.mkdir(parents=True, exist_ok=True)
    dataframe = gpd.read_file(input_path)

    try:
        dataframe.to_parquet(
            output_path,
            index=False,
            compression="zstd",
            schema_version="1.1.0",
            write_covering_bbox=True,
        )
    except TypeError:
        dataframe.to_parquet(
            output_path,
            index=False,
            compression="zstd",
        )

    print(f"Wrote GeoParquet to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
