#!/usr/bin/env python3
"""
Build a cemetery-scale "site twin" package from native NYS ortho imagery and
USGS 3DEP LiDAR assets exposed through the Microsoft Planetary Computer.

The pipeline is designed for Albany Rural Cemetery by default, but the AOI,
county, and municipality may be overridden from the command line.

Native source files are preserved under output/geospatial/<aoi-hash>/raw/.
Derived rasters and quasi-3D preview products are written under
output/geospatial/<aoi-hash>/derived/.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()


USER_AGENT = "fab-site-twin/1.0 (+https://gis.ny.gov/orthoimagery)"
NYS_ORTHO_COUNTY_PAGE_TEMPLATE = "https://gis.ny.gov/{county_slug}-county-orthoimagery-downloads"
NYS_ORTHO_INDEX_URL = "https://gis.ny.gov/orthoimagery"
PLANETARY_COMPUTER_STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
PLANETARY_COMPUTER_SIGN_URL = "https://planetarycomputer.microsoft.com/api/sas/v1/sign"
PLANETARY_COMPUTER_DATASET_URL = "https://planetarycomputer.microsoft.com/dataset/group/3dep-lidar"
LIDAR_COLLECTIONS = [
    "3dep-lidar-copc",
    "3dep-lidar-dtm",
    "3dep-lidar-dsm",
    "3dep-lidar-hag",
    "3dep-lidar-intensity",
    "3dep-lidar-classification",
]
HEADSTONE_SOURCES = [
    "src/data/Projected_Sec49_Headstones.json",
    "src/data/Projected_Sec75_Headstones.json",
]
DEFAULT_AOI_PATH = "src/data/ARC_Boundary.json"
DEFAULT_COUNTY = "Albany"
DEFAULT_PREVIEW_RESOLUTION_M = 0.5
DEFAULT_BUFFER_M = 20.0
DEFAULT_PUBLIC_ROOT = "public/data/site_twin"
DEFAULT_PUBLIC_BASE_URL = "/data/site_twin"


@dataclass
class AoiContext:
    aoi_path: Path
    geometry_wgs84: ogr.Geometry
    bbox_wgs84: tuple[float, float, float, float]
    centroid_wgs84: tuple[float, float]
    county: str
    municipality: str
    working_epsg: int
    aoi_hash: str
    feature_count: int


@dataclass
class OrthoDownload:
    county_page_url: str
    year: int
    municipality_label: str
    municipality_normalized: str
    zip_url: str
    resolution_note: str | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Download native ortho imagery and LiDAR for a cemetery AOI, then "
            "build quasi-3D grave-relief rasters."
        )
    )
    parser.add_argument("--aoi", default=DEFAULT_AOI_PATH, help="Path to the AOI GeoJSON boundary.")
    parser.add_argument(
        "--county",
        default=DEFAULT_COUNTY,
        help="County name used to resolve the NYS ortho download page.",
    )
    parser.add_argument(
        "--municipality",
        default=None,
        help="Municipality name to match on the county ortho download page. Defaults to AOI property PrclMuni.",
    )
    parser.add_argument(
        "--ortho-year",
        type=int,
        default=None,
        help="Preferred ortho year. Defaults to the newest year available on the county page.",
    )
    parser.add_argument(
        "--out",
        default="output/geospatial",
        help="Root output directory for raw downloads, metadata, and derived assets.",
    )
    parser.add_argument(
        "--preview-resolution-m",
        type=float,
        default=DEFAULT_PREVIEW_RESOLUTION_M,
        help="Target metric pixel size for the quasi-3D preview grid.",
    )
    parser.add_argument(
        "--terrain-only",
        action="store_true",
        help=(
            "Skip the ortho download and build a terrain-shaded surface from LiDAR derivatives only. "
            "Useful for faster renderer iteration before the native ortho package is pulled."
        ),
    )
    parser.add_argument(
        "--buffer-m",
        type=float,
        default=DEFAULT_BUFFER_M,
        help="Buffer distance used around the site while building shaded preview products.",
    )
    parser.add_argument(
        "--headstone-buffer-m",
        type=float,
        default=0.85,
        help="Buffer radius for known headstone point anchors when rasterizing preview masks.",
    )
    parser.add_argument(
        "--metadata-only",
        action="store_true",
        help="Resolve inputs and write a manifest without downloading large files.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Redownload and rebuild outputs even if files already exist.",
    )
    parser.add_argument(
        "--public-root",
        default=DEFAULT_PUBLIC_ROOT,
        help="Static export directory for the app-consumable site twin manifest and assets.",
    )
    parser.add_argument(
        "--public-base-url",
        default=DEFAULT_PUBLIC_BASE_URL,
        help="Public URL prefix used inside the static site twin manifest.",
    )
    return parser.parse_args()


def log(message: str) -> None:
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    print(f"[{timestamp}] {message}", flush=True)


def slugify(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    return lowered.strip("-")


def normalize_name(value: str | None) -> str:
    if not value:
        return ""
    value = value.lower()
    value = value.replace("&nbsp;", " ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\b(city|town|village|county|of)\b", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def ensure_directory(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def http_get_text(url: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request) as response:
        return response.read().decode("utf-8", "ignore")


def http_get_json(url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body = None
    headers = {"User-Agent": USER_AGENT}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def download_file(url: str, destination: Path, force: bool = False) -> Path:
    ensure_directory(destination.parent)
    if destination.exists() and not force:
        log(f"Reusing {destination}")
        return destination

    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request) as response, destination.open("wb") as handle:
        total = response.headers.get("Content-Length")
        total_bytes = int(total) if total and total.isdigit() else None
        downloaded = 0
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)
            downloaded += len(chunk)
            if total_bytes:
                pct = downloaded / total_bytes * 100.0
                print(
                    f"\rDownloading {destination.name}: {downloaded / 1_048_576:.1f} MiB "
                    f"of {total_bytes / 1_048_576:.1f} MiB ({pct:.1f}%)",
                    end="",
                    flush=True,
                )
        if total_bytes:
            print("", flush=True)
    return destination


def read_geojson(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_aoi_context(aoi_path: Path, county: str, municipality_override: str | None) -> AoiContext:
    if not aoi_path.exists():
        raise FileNotFoundError(f"AOI boundary not found: {aoi_path}")

    data = read_geojson(aoi_path)
    features = data.get("features", [])
    if not features:
        raise ValueError(f"AOI GeoJSON has no features: {aoi_path}")

    first_properties = features[0].get("properties", {})
    municipality = municipality_override or first_properties.get("PrclMuni") or first_properties.get("municipality")
    if not municipality:
        raise ValueError(
            "Unable to infer municipality from AOI properties. Pass --municipality explicitly."
        )

    source_srs = osr.SpatialReference()
    crs_name = data.get("crs", {}).get("properties", {}).get("name", "")
    if crs_name.endswith("CRS84"):
        source_srs.SetFromUserInput("OGC:CRS84")
    else:
        source_srs.ImportFromEPSG(4326)

    union_geometry = None
    for feature in features:
        geometry = ogr.CreateGeometryFromJson(json.dumps(feature.get("geometry")))
        geometry.AssignSpatialReference(source_srs)
        if union_geometry is None:
            union_geometry = geometry.Clone()
        else:
            union_geometry = union_geometry.Union(geometry)
    if union_geometry is None:
        raise ValueError(f"AOI geometry could not be loaded from {aoi_path}")

    wgs84 = osr.SpatialReference()
    wgs84.ImportFromEPSG(4326)
    geometry_wgs84 = transform_geometry(union_geometry, source_srs, wgs84)
    min_x, max_x, min_y, max_y = geometry_wgs84.GetEnvelope()
    centroid = geometry_wgs84.Centroid()
    centroid_lon = centroid.GetX()
    centroid_lat = centroid.GetY()
    working_epsg = estimate_utm_epsg(centroid_lon, centroid_lat)
    aoi_hash = hashlib.sha256(
        json.dumps(features, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()[:12]

    return AoiContext(
        aoi_path=aoi_path,
        geometry_wgs84=geometry_wgs84,
        bbox_wgs84=(min_x, min_y, max_x, max_y),
        centroid_wgs84=(centroid_lon, centroid_lat),
        county=county,
        municipality=str(municipality),
        working_epsg=working_epsg,
        aoi_hash=aoi_hash,
        feature_count=len(features),
    )


def estimate_utm_epsg(lon: float, lat: float) -> int:
    zone = int(math.floor((lon + 180.0) / 6.0) + 1)
    base = 32600 if lat >= 0.0 else 32700
    return base + zone


def spatial_reference_from_epsg(epsg: int) -> osr.SpatialReference:
    spatial_ref = osr.SpatialReference()
    spatial_ref.ImportFromEPSG(epsg)
    return spatial_ref


def transform_geometry(
    geometry: ogr.Geometry,
    source_srs: osr.SpatialReference,
    target_srs: osr.SpatialReference,
) -> ogr.Geometry:
    transformed = geometry.Clone()
    source_clone = source_srs.Clone()
    target_clone = target_srs.Clone()
    source_clone.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    target_clone.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(source_clone, target_clone)
    transformed.Transform(transform)
    transformed.AssignSpatialReference(target_clone)
    return transformed


def write_single_feature_geojson(path: Path, geometry: ogr.Geometry, spatial_ref: osr.SpatialReference) -> None:
    driver = ogr.GetDriverByName("GeoJSON")
    if path.exists():
        driver.DeleteDataSource(str(path))
    dataset = driver.CreateDataSource(str(path))
    layer = dataset.CreateLayer("aoi", srs=spatial_ref, geom_type=geometry.GetGeometryType())
    definition = layer.GetLayerDefn()
    feature = ogr.Feature(definition)
    feature.SetGeometry(geometry)
    layer.CreateFeature(feature)
    feature = None
    layer = None
    dataset = None


def build_aoi_workspace(aoi: AoiContext, output_root: Path, buffer_m: float) -> dict[str, Path]:
    metadata_dir = ensure_directory(output_root / "metadata")
    wgs84 = spatial_reference_from_epsg(4326)
    working_srs = spatial_reference_from_epsg(aoi.working_epsg)

    geometry_utm = transform_geometry(aoi.geometry_wgs84, wgs84, working_srs)
    buffered_utm = geometry_utm.Buffer(buffer_m)
    buffered_wgs84 = transform_geometry(buffered_utm, working_srs, wgs84)

    exact_wgs84_path = metadata_dir / "aoi_exact_wgs84.geojson"
    exact_utm_path = metadata_dir / f"aoi_exact_epsg{aoi.working_epsg}.geojson"
    buffered_wgs84_path = metadata_dir / "aoi_buffered_wgs84.geojson"
    buffered_utm_path = metadata_dir / f"aoi_buffered_epsg{aoi.working_epsg}.geojson"

    write_single_feature_geojson(exact_wgs84_path, aoi.geometry_wgs84, wgs84)
    write_single_feature_geojson(exact_utm_path, geometry_utm, working_srs)
    write_single_feature_geojson(buffered_wgs84_path, buffered_wgs84, wgs84)
    write_single_feature_geojson(buffered_utm_path, buffered_utm, working_srs)

    return {
        "exact_wgs84": exact_wgs84_path,
        "exact_utm": exact_utm_path,
        "buffered_wgs84": buffered_wgs84_path,
        "buffered_utm": buffered_utm_path,
    }


def parse_year_sections(html: str) -> list[tuple[int, str, str | None]]:
    matches = list(re.finditer(r"<h2[^>]*>(.*?)</h2>", html, flags=re.IGNORECASE | re.DOTALL))
    sections: list[tuple[int, str, str | None]] = []
    for index, match in enumerate(matches):
        heading_text = strip_html(match.group(1))
        year_match = re.search(r"\b(20\d{2}|19\d{2})\b", heading_text)
        if not year_match or "orthoimagery" not in heading_text.lower():
            continue
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(html)
        section_html = html[start:end]
        note_match = re.search(r"<strong>(.*?)</strong>", section_html, flags=re.IGNORECASE | re.DOTALL)
        note = strip_html(note_match.group(1)) if note_match else None
        sections.append((int(year_match.group(1)), section_html, note))
    return sections


def strip_html(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    value = value.replace("&nbsp;", " ")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def resolve_ortho_download(
    county: str,
    municipality: str,
    preferred_year: int | None = None,
) -> OrthoDownload:
    county_slug = slugify(county)
    county_page_url = NYS_ORTHO_COUNTY_PAGE_TEMPLATE.format(county_slug=county_slug)
    html = http_get_text(county_page_url)
    municipality_normalized = normalize_name(municipality)
    sections = parse_year_sections(html)
    if preferred_year is not None:
        sections = [section for section in sections if section[0] == preferred_year]
    else:
        sections.sort(key=lambda section: section[0], reverse=True)

    for year, section_html, note in sections:
        links = re.findall(
            r'<a\s+href="([^"]+\.zip)"[^>]*>([^<]+)</a>',
            section_html,
            flags=re.IGNORECASE,
        )
        for href, label in links:
            label_clean = strip_html(label)
            if normalize_name(label_clean) == municipality_normalized:
                return OrthoDownload(
                    county_page_url=county_page_url,
                    year=year,
                    municipality_label=label_clean,
                    municipality_normalized=municipality_normalized,
                    zip_url=href,
                    resolution_note=note,
                )

    available = [str(section[0]) for section in sections]
    raise RuntimeError(
        f"Could not resolve municipality '{municipality}' on {county_page_url}. "
        f"Checked years: {', '.join(available) or 'none'}."
    )


def stac_search(collections: list[str], bbox: tuple[float, float, float, float]) -> list[dict[str, Any]]:
    payload = {
        "collections": collections,
        "bbox": list(bbox),
        "limit": 100,
    }
    response = http_get_json(PLANETARY_COMPUTER_STAC_URL, payload)
    features = response.get("features", [])
    return sorted(features, key=lambda feature: (feature.get("collection", ""), feature.get("id", "")))


def sign_planetary_computer_href(href: str) -> dict[str, str]:
    url = PLANETARY_COMPUTER_SIGN_URL + "?href=" + urllib.parse.quote(href, safe="")
    return http_get_json(url)


def collect_lidar_assets(
    bbox: tuple[float, float, float, float],
) -> dict[str, list[dict[str, Any]]]:
    features = stac_search(LIDAR_COLLECTIONS, bbox)
    grouped: dict[str, list[dict[str, Any]]] = {}
    for feature in features:
        collection = feature["collection"]
        grouped.setdefault(collection, []).append(feature)
    return grouped


def get_original_asset_href(feature: dict[str, Any], asset_key: str = "data") -> str:
    assets = feature.get("assets", {})
    if asset_key not in assets or "href" not in assets[asset_key]:
        raise KeyError(f"Asset '{asset_key}' missing from item {feature.get('id')}")
    return assets[asset_key]["href"]


def stage_raw_downloads(
    ortho: OrthoDownload | None,
    lidar_assets: dict[str, list[dict[str, Any]]],
    raw_root: Path,
    force: bool,
    metadata_only: bool,
    download_derivative_collections: bool,
) -> dict[str, Any]:
    raw_ortho_dir = ensure_directory(raw_root / "ortho")
    raw_lidar_dir = ensure_directory(raw_root / "lidar")

    ortho_zip_path: Path | None = None
    if ortho is not None:
        ortho_zip_path = raw_ortho_dir / Path(urllib.parse.urlparse(ortho.zip_url).path).name
        if not metadata_only:
            log(f"Downloading native ortho ZIP from {ortho.zip_url}")
            download_file(ortho.zip_url, ortho_zip_path, force=force)

    lidar_downloads: dict[str, list[dict[str, Any]]] = {}
    for collection, items in lidar_assets.items():
        collection_dir = ensure_directory(raw_lidar_dir / collection)
        collection_records: list[dict[str, Any]] = []
        should_download = collection == "3dep-lidar-copc" or download_derivative_collections
        for item in items:
            original_href = get_original_asset_href(item)
            target_path = collection_dir / Path(urllib.parse.urlparse(original_href).path).name
            signed_payload = sign_planetary_computer_href(original_href)
            signed_href = signed_payload["href"]
            if should_download and not metadata_only:
                log(f"Downloading {collection} item {item['id']}")
                download_file(signed_href, target_path, force=force)
            collection_records.append(
                {
                    "item_id": item["id"],
                    "original_href": original_href,
                    "signed_expiry": signed_payload.get("msft:expiry"),
                    "local_path": str(target_path) if should_download else None,
                }
            )
        lidar_downloads[collection] = collection_records

    return {
        "ortho_zip_path": str(ortho_zip_path) if ortho_zip_path else None,
        "lidar_downloads": lidar_downloads,
    }


def collect_ortho_vsi_members(ortho_zip_path: Path) -> list[str]:
    if not ortho_zip_path.exists():
        raise FileNotFoundError(f"Ortho ZIP not found: {ortho_zip_path}")
    with zipfile.ZipFile(ortho_zip_path) as archive:
        members = [
            member
            for member in archive.namelist()
            if member.lower().endswith((".tif", ".tiff"))
        ]
    if not members:
        raise RuntimeError(f"No TIFF members found in {ortho_zip_path}")
    zip_prefix = f"/vsizip/{ortho_zip_path.resolve().as_posix()}"
    return [f"{zip_prefix}/{member}" for member in members]


def build_vrt(sources: list[str], vrt_path: Path) -> Path:
    if vrt_path.exists():
        vrt_path.unlink()
    dataset = gdal.BuildVRT(str(vrt_path), sources)
    if dataset is None:
        raise RuntimeError(f"Failed to build VRT: {vrt_path}")
    dataset = None
    return vrt_path


def warp_raster(
    source: str | Path,
    destination: Path,
    *,
    dst_epsg: int,
    cutline_path: Path,
    x_res: float | None = None,
    y_res: float | None = None,
    resample_alg: str = "bilinear",
    dst_nodata: float | int | None = None,
) -> Path:
    ensure_directory(destination.parent)
    creation_options = [
        "TILED=YES",
        "COMPRESS=DEFLATE",
        "PREDICTOR=2",
        "BIGTIFF=IF_SAFER",
    ]
    options = gdal.WarpOptions(
        format="GTiff",
        dstSRS=f"EPSG:{dst_epsg}",
        cutlineDSName=str(cutline_path),
        cropToCutline=True,
        multithread=True,
        targetAlignedPixels=bool(x_res and y_res),
        xRes=x_res,
        yRes=y_res,
        resampleAlg=resample_alg,
        dstNodata=dst_nodata,
        creationOptions=creation_options,
    )
    dataset = gdal.Warp(str(destination), str(source), options=options)
    if dataset is None:
        raise RuntimeError(f"gdal.Warp failed for {destination}")
    dataset = None
    return destination


def get_projection(dataset: gdal.Dataset) -> osr.SpatialReference:
    spatial_ref = osr.SpatialReference()
    spatial_ref.ImportFromWkt(dataset.GetProjection())
    spatial_ref.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return spatial_ref


def create_template_like(path: Path, template: gdal.Dataset, bands: int, data_type: int) -> gdal.Dataset:
    driver = gdal.GetDriverByName("GTiff")
    dataset = driver.Create(
        str(path),
        template.RasterXSize,
        template.RasterYSize,
        bands,
        data_type,
        options=[
            "TILED=YES",
            "COMPRESS=DEFLATE",
            "PREDICTOR=2",
            "BIGTIFF=IF_SAFER",
        ],
    )
    dataset.SetGeoTransform(template.GetGeoTransform())
    dataset.SetProjection(template.GetProjection())
    return dataset


def create_boundary_mask(
    template_path: Path,
    exact_boundary_path: Path,
    output_path: Path,
) -> Path:
    template = gdal.Open(str(template_path))
    if template is None:
        raise RuntimeError(f"Unable to open template raster {template_path}")

    mask_dataset = create_template_like(output_path, template, 1, gdal.GDT_Byte)
    band = mask_dataset.GetRasterBand(1)
    band.Fill(0)
    band.SetNoDataValue(0)

    vector = ogr.Open(str(exact_boundary_path))
    if vector is None:
        raise RuntimeError(f"Unable to open exact boundary cutline {exact_boundary_path}")
    layer = vector.GetLayer(0)
    gdal.RasterizeLayer(mask_dataset, [1], layer, burn_values=[255])

    band = None
    layer = None
    vector = None
    mask_dataset = None
    template = None
    return output_path


def build_headstone_anchor_mask(
    template_path: Path,
    headstone_sources: list[Path],
    output_path: Path,
    *,
    headstone_buffer_m: float,
) -> Path:
    template = gdal.Open(str(template_path))
    if template is None:
        raise RuntimeError(f"Unable to open template raster {template_path}")
    target_srs = get_projection(template)

    driver = ogr.GetDriverByName("MEM")
    source_dataset = driver.CreateDataSource("headstone_anchor")
    layer = source_dataset.CreateLayer("headstone_anchor", srs=target_srs, geom_type=ogr.wkbPolygon)
    layer.CreateField(ogr.FieldDefn("burn", ogr.OFTInteger))
    definition = layer.GetLayerDefn()

    for headstone_path in headstone_sources:
        if not headstone_path.exists():
            continue
        vector = ogr.Open(str(headstone_path))
        if vector is None:
            continue
        source_layer = vector.GetLayer(0)
        source_srs = source_layer.GetSpatialRef()
        if source_srs is None:
            source_srs = spatial_reference_from_epsg(4326)
        transform = create_coordinate_transform(source_srs, target_srs)
        for feature in source_layer:
            geometry = feature.GetGeometryRef()
            if geometry is None:
                continue
            buffered = geometry.Clone()
            if ogr.GT_Flatten(buffered.GetGeometryType()) == ogr.wkbPoint:
                x = buffered.GetX()
                y = buffered.GetY()
                if not math.isfinite(x) or not math.isfinite(y):
                    continue
                if x < -180.0 or x > 180.0 or y < -90.0 or y > 90.0:
                    continue
            buffered.Transform(transform)
            buffered = buffered.Buffer(headstone_buffer_m)
            buffered_feature = ogr.Feature(definition)
            buffered_feature.SetField("burn", 1)
            buffered_feature.SetGeometry(buffered)
            layer.CreateFeature(buffered_feature)
            buffered_feature = None
        source_layer = None
        vector = None

    anchor_dataset = create_template_like(output_path, template, 1, gdal.GDT_Byte)
    anchor_band = anchor_dataset.GetRasterBand(1)
    anchor_band.Fill(0)
    anchor_band.SetNoDataValue(0)
    gdal.RasterizeLayer(anchor_dataset, [1], layer, burn_values=[255])

    anchor_band = None
    anchor_dataset = None
    layer = None
    source_dataset = None
    template = None
    return output_path


def read_raster_array(path: Path) -> tuple[np.ndarray, gdal.Dataset]:
    dataset = gdal.Open(str(path))
    if dataset is None:
        raise RuntimeError(f"Unable to open raster {path}")
    array = dataset.ReadAsArray()
    if array is None:
        raise RuntimeError(f"Unable to read raster array {path}")
    return array, dataset


def robust_normalize(array: np.ndarray, valid_mask: np.ndarray, lower_pct: float, upper_pct: float) -> np.ndarray:
    output = np.zeros(array.shape, dtype=np.float32)
    valid_values = array[valid_mask]
    if valid_values.size == 0:
        return output
    lo = np.percentile(valid_values, lower_pct)
    hi = np.percentile(valid_values, upper_pct)
    if not np.isfinite(lo) or not np.isfinite(hi) or hi <= lo:
        return output
    output[valid_mask] = np.clip((array[valid_mask] - lo) / (hi - lo), 0.0, 1.0)
    return output


def write_float32_raster(path: Path, array: np.ndarray, template: gdal.Dataset, nodata: float = -9999.0) -> Path:
    dataset = create_template_like(path, template, 1, gdal.GDT_Float32)
    band = dataset.GetRasterBand(1)
    band.WriteArray(array.astype(np.float32))
    band.SetNoDataValue(nodata)
    band.FlushCache()
    band = None
    dataset = None
    return path


def write_rgba_raster(path: Path, rgba: np.ndarray, template: gdal.Dataset) -> Path:
    dataset = create_template_like(path, template, 4, gdal.GDT_Byte)
    color_interpretations = [
        gdal.GCI_RedBand,
        gdal.GCI_GreenBand,
        gdal.GCI_BlueBand,
        gdal.GCI_AlphaBand,
    ]
    for index in range(4):
        band = dataset.GetRasterBand(index + 1)
        band.WriteArray(rgba[index].astype(np.uint8))
        band.SetColorInterpretation(color_interpretations[index])
        band.SetNoDataValue(0)
        band.FlushCache()
        band = None
    dataset = None
    return path


def translate_png(source: Path, destination: Path) -> Path:
    ensure_directory(destination.parent)
    dataset = gdal.Translate(str(destination), str(source), format="PNG")
    if dataset is None:
        raise RuntimeError(f"Failed to export PNG {destination}")
    dataset = None
    return destination


def copy_file(source: Path, destination: Path) -> Path:
    ensure_directory(destination.parent)
    shutil.copy2(source, destination)
    return destination


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def create_coordinate_transform(
    source_srs: osr.SpatialReference,
    target_srs: osr.SpatialReference,
) -> osr.CoordinateTransformation:
    source_clone = source_srs.Clone()
    target_clone = target_srs.Clone()
    source_clone.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    target_clone.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return osr.CoordinateTransformation(source_clone, target_clone)


def transform_xy(
    transform: osr.CoordinateTransformation,
    x: float,
    y: float,
) -> tuple[float, float]:
    next_x, next_y, _ = transform.TransformPoint(x, y)
    return float(next_x), float(next_y)


def point_within_geometry(geometry: ogr.Geometry, lon: float, lat: float) -> bool:
    spatial_ref = geometry.GetSpatialReference()
    point = ogr.Geometry(ogr.wkbPoint)
    point.AssignSpatialReference(spatial_ref)
    point.AddPoint(lon, lat)
    return bool(geometry.Contains(point) or geometry.Intersects(point))


def world_to_pixel_indices(
    geotransform: tuple[float, float, float, float, float, float],
    x: float,
    y: float,
) -> tuple[int, int] | None:
    pixel_width = float(geotransform[1])
    pixel_height = float(geotransform[5])
    if not math.isfinite(pixel_width) or pixel_width == 0.0:
        return None
    if not math.isfinite(pixel_height) or pixel_height == 0.0:
        return None
    pixel = int(math.floor((x - geotransform[0]) / pixel_width))
    line = int(math.floor((y - geotransform[3]) / pixel_height))
    return pixel, line


def sample_window(
    array: np.ndarray,
    geotransform: tuple[float, float, float, float, float, float],
    x: float,
    y: float,
    *,
    radius_pixels: int = 1,
) -> np.ndarray:
    pixel_indices = world_to_pixel_indices(geotransform, x, y)
    if pixel_indices is None:
        return np.empty((0, 0), dtype=array.dtype)
    pixel, line = pixel_indices
    if pixel < 0 or line < 0 or pixel >= array.shape[1] or line >= array.shape[0]:
        return np.empty((0, 0), dtype=array.dtype)

    row_start = max(0, line - radius_pixels)
    row_end = min(array.shape[0], line + radius_pixels + 1)
    col_start = max(0, pixel - radius_pixels)
    col_end = min(array.shape[1], pixel + radius_pixels + 1)
    return array[row_start:row_end, col_start:col_end]


def sample_window_max(
    array: np.ndarray,
    geotransform: tuple[float, float, float, float, float, float],
    x: float,
    y: float,
    *,
    radius_pixels: int = 1,
) -> float:
    window = sample_window(array, geotransform, x, y, radius_pixels=radius_pixels)
    if window.size == 0:
        return 0.0
    valid = window[np.isfinite(window)]
    if valid.size == 0:
        return 0.0
    return float(np.max(valid))


def sample_window_mode(
    array: np.ndarray,
    geotransform: tuple[float, float, float, float, float, float],
    x: float,
    y: float,
    *,
    radius_pixels: int = 1,
) -> int | None:
    window = sample_window(array, geotransform, x, y, radius_pixels=radius_pixels)
    if window.size == 0:
        return None
    flattened = window.astype(np.int32).ravel()
    flattened = flattened[np.isfinite(flattened)]
    if flattened.size == 0:
        return None
    values, counts = np.unique(flattened, return_counts=True)
    return int(values[np.argmax(counts)])


def get_raster_bounds_wgs84(path: Path) -> list[list[float]]:
    dataset = gdal.Open(str(path))
    if dataset is None:
        raise RuntimeError(f"Unable to open raster {path}")
    geotransform = dataset.GetGeoTransform()
    source_srs = get_projection(dataset)
    wgs84 = spatial_reference_from_epsg(4326)
    transform = create_coordinate_transform(source_srs, wgs84)
    width = dataset.RasterXSize
    height = dataset.RasterYSize
    corners = [
        (0, 0),
        (width, 0),
        (width, height),
        (0, height),
    ]
    longitudes: list[float] = []
    latitudes: list[float] = []
    for pixel, line in corners:
        x = geotransform[0] + (pixel * geotransform[1]) + (line * geotransform[2])
        y = geotransform[3] + (pixel * geotransform[4]) + (line * geotransform[5])
        lon, lat = transform_xy(transform, x, y)
        longitudes.append(lon)
        latitudes.append(lat)
    dataset = None
    return [
        [float(min(latitudes)), float(min(longitudes))],
        [float(max(latitudes)), float(max(longitudes))],
    ]


def classification_label(code: int | None) -> str:
    labels = {
        0: "never-classified",
        1: "unclassified",
        2: "ground",
        3: "low-vegetation",
        4: "medium-vegetation",
        5: "high-vegetation",
        6: "building",
        7: "noise",
        9: "water",
        10: "rail",
        11: "road-surface",
        13: "wire-guard",
        14: "wire-conductor",
        15: "transmission-tower",
        16: "wire-connector",
        17: "bridge-deck",
        18: "high-noise",
        19: "overlap",
        20: "ignored-ground",
        21: "snow",
        22: "temporal-exclusion",
    }
    if code is None:
        return "unknown"
    return labels.get(int(code), "unknown")


def write_geojson(path: Path, feature_collection: dict[str, Any]) -> Path:
    ensure_directory(path.parent)
    path.write_text(json.dumps(feature_collection, indent=2), encoding="utf-8")
    return path


def run_pdal_info(copc_path: Path, output_json_path: Path) -> Path:
    ensure_directory(output_json_path.parent)
    result = subprocess.run(
        ["pdal", "info", "--metadata", str(copc_path)],
        capture_output=True,
        check=True,
        text=True,
    )
    output_json_path.write_text(result.stdout, encoding="utf-8")
    return output_json_path


def build_multi_azimuth_hillshade(
    dtm_path: Path,
    work_dir: Path,
) -> Path:
    ensure_directory(work_dir)
    azimuths = [315, 45, 270]
    hillshade_paths: list[Path] = []
    for azimuth in azimuths:
        hillshade_path = work_dir / f"hillshade_az{azimuth}.tif"
        dataset = gdal.DEMProcessing(
            str(hillshade_path),
            str(dtm_path),
            "hillshade",
            azimuth=azimuth,
            altitude=45.0,
            computeEdges=True,
            format="GTiff",
            creationOptions=[
                "TILED=YES",
                "COMPRESS=DEFLATE",
                "PREDICTOR=2",
                "BIGTIFF=IF_SAFER",
            ],
        )
        if dataset is None:
            raise RuntimeError(f"Failed to build hillshade for azimuth {azimuth}")
        dataset = None
        hillshade_paths.append(hillshade_path)

    arrays = []
    template = None
    for hillshade_path in hillshade_paths:
        array, dataset = read_raster_array(hillshade_path)
        arrays.append(array.astype(np.float32))
        if template is None:
            template = dataset
        else:
            dataset = None
    assert template is not None
    merged = np.mean(arrays, axis=0).astype(np.float32)
    output_path = work_dir / "hillshade_multi_azimuth.tif"
    write_float32_raster(output_path, merged, template)
    template = None
    return output_path


def build_ndsm(
    dsm_path: Path,
    dtm_path: Path,
    output_path: Path,
) -> Path:
    dsm_array, dsm_dataset = read_raster_array(dsm_path)
    dtm_array, dtm_dataset = read_raster_array(dtm_path)
    ndsm = np.maximum(dsm_array.astype(np.float32) - dtm_array.astype(np.float32), 0.0)
    write_float32_raster(output_path, ndsm, dsm_dataset)
    dsm_dataset = None
    dtm_dataset = None
    return output_path


def build_quasi_3d_preview(
    *,
    ortho_path: Path,
    hillshade_path: Path,
    ndsm_path: Path,
    hag_path: Path,
    intensity_path: Path,
    boundary_mask_path: Path,
    anchor_mask_path: Path,
    output_tif_path: Path,
    output_png_path: Path,
) -> dict[str, Any]:
    ortho_array, ortho_dataset = read_raster_array(ortho_path)
    hillshade_array, _ = read_raster_array(hillshade_path)
    ndsm_array, _ = read_raster_array(ndsm_path)
    hag_array, _ = read_raster_array(hag_path)
    intensity_array, _ = read_raster_array(intensity_path)
    boundary_mask, _ = read_raster_array(boundary_mask_path)
    anchor_mask, _ = read_raster_array(anchor_mask_path)

    if ortho_array.ndim != 3 or ortho_array.shape[0] < 3:
        raise RuntimeError(f"Expected at least 3 bands in ortho raster {ortho_path}")

    alpha_mask = boundary_mask > 0
    ortho_rgb = ortho_array[:3].astype(np.float32)
    ortho_valid = alpha_mask & (ortho_rgb[0] > 0)

    ortho_norm = np.zeros_like(ortho_rgb, dtype=np.float32)
    band_stats: list[dict[str, float]] = []
    for index in range(3):
        band_normalized = robust_normalize(ortho_rgb[index], ortho_valid, 1.0, 99.0)
        ortho_norm[index] = band_normalized
        if ortho_valid.any():
            band_values = ortho_rgb[index][ortho_valid]
            band_stats.append(
                {
                    "band": index + 1,
                    "p01": float(np.percentile(band_values, 1.0)),
                    "p99": float(np.percentile(band_values, 99.0)),
                }
            )
        else:
            band_stats.append({"band": index + 1, "p01": 0.0, "p99": 0.0})

    relief_valid = alpha_mask
    hillshade_norm = np.clip(hillshade_array.astype(np.float32) / 255.0, 0.0, 1.0)
    monument_relief = np.clip(np.maximum(ndsm_array.astype(np.float32), hag_array.astype(np.float32)) / 2.0, 0.0, 1.0)
    intensity_norm = robust_normalize(intensity_array.astype(np.float32), relief_valid, 2.0, 98.0)
    anchor_norm = np.clip(anchor_mask.astype(np.float32) / 255.0, 0.0, 1.0)

    shade = np.clip(
        0.78
        + 0.60 * (hillshade_norm - 0.5)
        + 0.18 * monument_relief
        + 0.06 * intensity_norm
        + 0.08 * anchor_norm,
        0.40,
        1.45,
    )

    fused = ortho_norm * shade[np.newaxis, :, :]
    fused[0] += 0.08 * monument_relief + 0.04 * anchor_norm
    fused[1] += 0.05 * monument_relief + 0.02 * intensity_norm
    fused[2] += 0.02 * monument_relief
    fused = np.clip(fused, 0.0, 1.0)
    fused[:, ~alpha_mask] = 0.0

    rgba = np.zeros((4, ortho_dataset.RasterYSize, ortho_dataset.RasterXSize), dtype=np.uint8)
    rgba[:3] = np.round(fused * 255.0).astype(np.uint8)
    rgba[3] = np.where(alpha_mask, 255, 0).astype(np.uint8)

    write_rgba_raster(output_tif_path, rgba, ortho_dataset)
    translate_png(output_tif_path, output_png_path)

    if relief_valid.any():
        monument_values = monument_relief[relief_valid]
        hillshade_values = hillshade_norm[relief_valid]
        intensity_values = intensity_norm[relief_valid]
        preview_metrics = {
            "monument_relief_p95": float(np.percentile(monument_values, 95.0)),
            "hillshade_mean": float(np.mean(hillshade_values)),
            "intensity_mean": float(np.mean(intensity_values)),
        }
    else:
        preview_metrics = {
            "monument_relief_p95": 0.0,
            "hillshade_mean": 0.0,
            "intensity_mean": 0.0,
        }

    ortho_dataset = None
    return {
        "band_stats": band_stats,
        "preview_metrics": preview_metrics,
        "output_tif": str(output_tif_path),
        "output_png": str(output_png_path),
    }


def build_terrain_only_preview(
    *,
    dtm_path: Path,
    hillshade_path: Path,
    ndsm_path: Path,
    hag_path: Path,
    intensity_path: Path,
    classification_path: Path,
    boundary_mask_path: Path,
    anchor_mask_path: Path,
    output_tif_path: Path,
    output_png_path: Path,
) -> dict[str, Any]:
    dtm_array, _ = read_raster_array(dtm_path)
    hillshade_array, hillshade_dataset = read_raster_array(hillshade_path)
    ndsm_array, _ = read_raster_array(ndsm_path)
    hag_array, _ = read_raster_array(hag_path)
    intensity_array, _ = read_raster_array(intensity_path)
    classification_array, _ = read_raster_array(classification_path)
    boundary_mask, _ = read_raster_array(boundary_mask_path)
    anchor_mask, _ = read_raster_array(anchor_mask_path)

    alpha_mask = boundary_mask > 0
    relief_valid = alpha_mask
    elevation_norm = robust_normalize(dtm_array.astype(np.float32), relief_valid, 1.0, 99.0)
    hillshade_norm = robust_normalize(hillshade_array.astype(np.float32), relief_valid, 2.0, 98.0)
    monument_relief = robust_normalize(
        np.maximum(ndsm_array.astype(np.float32), hag_array.astype(np.float32)),
        relief_valid,
        65.0,
        99.7,
    )
    intensity_norm = robust_normalize(intensity_array.astype(np.float32), relief_valid, 2.0, 98.0)
    classification_ground = np.isin(classification_array.astype(np.int16), [2, 11, 17]).astype(np.float32)
    classification_vegetation = np.isin(classification_array.astype(np.int16), [3, 4, 5]).astype(np.float32)
    anchor_norm = np.clip(anchor_mask.astype(np.float32) / 255.0, 0.0, 1.0)

    base_red = np.full(hillshade_norm.shape, 0.54, dtype=np.float32)
    base_green = np.full(hillshade_norm.shape, 0.61, dtype=np.float32)
    base_blue = np.full(hillshade_norm.shape, 0.52, dtype=np.float32)

    base_red -= 0.03 * classification_ground
    base_green += 0.08 * classification_ground
    base_blue -= 0.02 * classification_ground

    base_red -= 0.05 * classification_vegetation
    base_green += 0.18 * classification_vegetation
    base_blue -= 0.03 * classification_vegetation

    base_red += 0.12 * elevation_norm
    base_green += 0.08 * elevation_norm
    base_blue += 0.04 * elevation_norm

    shade = np.clip(
        0.32
        + 1.04 * hillshade_norm
        + 0.10 * elevation_norm
        + 0.14 * intensity_norm
        + 0.18 * monument_relief
        + 0.12 * anchor_norm,
        0.22,
        1.44,
    )

    fused = np.zeros((3, hillshade_dataset.RasterYSize, hillshade_dataset.RasterXSize), dtype=np.float32)
    fused[0] = np.clip(base_red * shade + 0.12 * monument_relief + 0.08 * anchor_norm, 0.0, 1.0)
    fused[1] = np.clip(base_green * shade + 0.10 * monument_relief + 0.06 * intensity_norm, 0.0, 1.0)
    fused[2] = np.clip(base_blue * shade + 0.05 * monument_relief, 0.0, 1.0)
    fused[:, ~alpha_mask] = 0.0

    rgba = np.zeros((4, hillshade_dataset.RasterYSize, hillshade_dataset.RasterXSize), dtype=np.uint8)
    rgba[:3] = np.round(fused * 255.0).astype(np.uint8)
    rgba[3] = np.where(alpha_mask, 255, 0).astype(np.uint8)

    write_rgba_raster(output_tif_path, rgba, hillshade_dataset)
    translate_png(output_tif_path, output_png_path)

    if relief_valid.any():
        preview_metrics = {
            "monument_relief_p95": float(np.percentile(monument_relief[relief_valid], 95.0)),
            "hillshade_mean": float(np.mean(hillshade_norm[relief_valid])),
            "intensity_mean": float(np.mean(intensity_norm[relief_valid])),
            "ground_fraction": float(np.mean(classification_ground[relief_valid])),
            "vegetation_fraction": float(np.mean(classification_vegetation[relief_valid])),
        }
    else:
        preview_metrics = {
            "monument_relief_p95": 0.0,
            "hillshade_mean": 0.0,
            "intensity_mean": 0.0,
            "ground_fraction": 0.0,
            "vegetation_fraction": 0.0,
        }

    hillshade_dataset = None
    return {
        "band_stats": [],
        "preview_metrics": preview_metrics,
        "output_tif": str(output_tif_path),
        "output_png": str(output_png_path),
    }


def build_grave_candidate_geojson(
    *,
    aoi: AoiContext,
    ndsm_path: Path,
    hag_path: Path,
    classification_path: Path,
    output_path: Path,
) -> dict[str, Any]:
    ndsm_array, ndsm_dataset = read_raster_array(ndsm_path)
    hag_array, _ = read_raster_array(hag_path)
    classification_array, _ = read_raster_array(classification_path)
    geotransform = ndsm_dataset.GetGeoTransform()
    working_srs = get_projection(ndsm_dataset)
    wgs84 = spatial_reference_from_epsg(4326)
    to_working = create_coordinate_transform(wgs84, working_srs)

    bbox_min_x, bbox_min_y, bbox_max_x, bbox_max_y = aoi.bbox_wgs84

    burial_candidate_by_key: dict[tuple[float, float], dict[str, Any]] = {}
    burial_geojson = read_geojson(Path("src/data/Geo_Burials.json"))
    burial_features = burial_geojson.get("features", [])

    for feature_index, feature in enumerate(burial_features):
        geometry = feature.get("geometry", {})
        coordinates = geometry.get("coordinates", [])
        if geometry.get("type") != "Point" or len(coordinates) < 2:
            continue

        lon = float(coordinates[0])
        lat = float(coordinates[1])
        if lon < bbox_min_x or lon > bbox_max_x or lat < bbox_min_y or lat > bbox_max_y:
            continue
        if not point_within_geometry(aoi.geometry_wgs84, lon, lat):
            continue

        aggregate_key = (round(lon, 7), round(lat, 7))
        candidate = burial_candidate_by_key.get(aggregate_key)
        if candidate is None:
            x, y = transform_xy(to_working, lon, lat)
            candidate = {
                "id": f"burial-anchor-{len(burial_candidate_by_key) + 1}",
                "lon": lon,
                "lat": lat,
                "x": x,
                "y": y,
                "burialCount": 0,
                "knownHeadstone": False,
                "sourceDatasets": ["Geo_Burials.json"],
                "arcGeoId": feature.get("properties", {}).get("ARC_GeoID"),
                "section": feature.get("properties", {}).get("Section"),
            }
            burial_candidate_by_key[aggregate_key] = candidate
        candidate["burialCount"] += 1
        if not candidate.get("arcGeoId") and feature.get("properties", {}).get("ARC_GeoID"):
            candidate["arcGeoId"] = feature.get("properties", {}).get("ARC_GeoID")
        if candidate.get("section") is None and feature.get("properties", {}).get("Section") is not None:
            candidate["section"] = feature.get("properties", {}).get("Section")

    burial_candidates = list(burial_candidate_by_key.values())
    burial_bins: dict[tuple[int, int], list[dict[str, Any]]] = {}
    for candidate in burial_candidates:
        bucket_key = (int(math.floor(candidate["x"] / 1.25)), int(math.floor(candidate["y"] / 1.25)))
        burial_bins.setdefault(bucket_key, []).append(candidate)

    for headstone_path in [Path(path) for path in HEADSTONE_SOURCES]:
        if not headstone_path.exists():
            continue
        headstone_geojson = read_geojson(headstone_path)
        for feature in headstone_geojson.get("features", []):
            geometry = feature.get("geometry", {})
            coordinates = geometry.get("coordinates", [])
            if geometry.get("type") != "Point" or len(coordinates) < 2:
                continue

            lon = float(coordinates[0])
            lat = float(coordinates[1])
            if lon < bbox_min_x or lon > bbox_max_x or lat < bbox_min_y or lat > bbox_max_y:
                continue
            if not point_within_geometry(aoi.geometry_wgs84, lon, lat):
                continue

            x, y = transform_xy(to_working, lon, lat)
            bucket_x = int(math.floor(x / 1.25))
            bucket_y = int(math.floor(y / 1.25))
            nearest: dict[str, Any] | None = None
            nearest_distance = float("inf")

            for neighbor_x in range(bucket_x - 1, bucket_x + 2):
                for neighbor_y in range(bucket_y - 1, bucket_y + 2):
                    for candidate in burial_bins.get((neighbor_x, neighbor_y), []):
                        distance = math.hypot(candidate["x"] - x, candidate["y"] - y)
                        if distance < nearest_distance:
                            nearest = candidate
                            nearest_distance = distance

            if nearest is not None and nearest_distance <= 1.25:
                nearest["knownHeadstone"] = True
                nearest["lon"] = lon
                nearest["lat"] = lat
                nearest["x"] = x
                nearest["y"] = y
                nearest["sourceDatasets"] = sorted(set(nearest["sourceDatasets"] + [headstone_path.name]))
                continue

            burial_candidates.append({
                "id": f"headstone-anchor-{headstone_path.stem}-{feature.get('properties', {}).get('OBJECTID', len(burial_candidates) + 1)}",
                "lon": lon,
                "lat": lat,
                "x": x,
                "y": y,
                "burialCount": 0,
                "knownHeadstone": True,
                "sourceDatasets": [headstone_path.name],
                "arcGeoId": None,
                "section": feature.get("properties", {}).get("Section"),
            })

    features: list[dict[str, Any]] = []
    known_headstone_count = 0
    classification_counts: dict[str, int] = {}
    feature_heights: list[float] = []

    for candidate in burial_candidates:
        lidar_height = max(
            sample_window_max(ndsm_array, geotransform, candidate["x"], candidate["y"], radius_pixels=1),
            sample_window_max(hag_array, geotransform, candidate["x"], candidate["y"], radius_pixels=1),
        )
        classification_code = sample_window_mode(
            classification_array,
            geotransform,
            candidate["x"],
            candidate["y"],
            radius_pixels=1,
        )
        class_label = classification_label(classification_code)
        classification_counts[class_label] = classification_counts.get(class_label, 0) + 1

        fallback_height = 0.18 + min(0.22, math.log1p(candidate["burialCount"]) * 0.08)
        if candidate["knownHeadstone"]:
            fallback_height = max(fallback_height, 0.62)
        elif class_label.endswith("vegetation"):
            fallback_height = min(fallback_height, 0.24)

        render_height = max(lidar_height, fallback_height)
        height_confidence = clamp(lidar_height / 1.1, 0.0, 1.0)
        burial_density_confidence = clamp(math.log1p(candidate["burialCount"]) / math.log1p(12), 0.0, 1.0)
        confidence = clamp(
            0.18
            + (0.42 * height_confidence)
            + (0.12 * burial_density_confidence)
            + (0.36 if candidate["knownHeadstone"] else 0.0)
            + (0.06 if class_label not in {"ground", "water"} else -0.03),
            0.2,
            0.98,
        )

        if candidate["knownHeadstone"]:
            known_headstone_count += 1
        feature_heights.append(render_height)

        features.append({
            "type": "Feature",
            "id": candidate["id"],
            "geometry": {
                "type": "Point",
                "coordinates": [candidate["lon"], candidate["lat"]],
            },
            "properties": {
                "id": candidate["id"],
                "candidateType": "known-headstone" if candidate["knownHeadstone"] else "burial-anchor",
                "knownHeadstone": candidate["knownHeadstone"],
                "burialCount": candidate["burialCount"],
                "arcGeoId": candidate["arcGeoId"],
                "section": candidate["section"],
                "heightMeters": round(render_height, 3),
                "lidarHeightMeters": round(lidar_height, 3),
                "confidence": round(confidence, 3),
                "classificationCode": classification_code,
                "classificationLabel": class_label,
                "sourceDatasets": candidate["sourceDatasets"],
            },
        })

    feature_collection = {
        "type": "FeatureCollection",
        "features": sorted(features, key=lambda feature: str(feature["id"] or "")),
    }
    write_geojson(output_path, feature_collection)

    ndsm_dataset = None
    return {
        "output_path": str(output_path),
        "count": len(features),
        "known_headstone_count": known_headstone_count,
        "classification_counts": classification_counts,
        "height_p95_m": float(np.percentile(feature_heights, 95.0)) if feature_heights else 0.0,
    }


def build_source_vintage_note(
    ortho: OrthoDownload | None,
    *,
    terrain_only: bool,
) -> str:
    if terrain_only or ortho is None:
        return (
            "Terrain surface is derived from the intersecting NY_Columbia_Rensselaer_2016 "
            "3DEP LiDAR project on Planetary Computer. Native ortho was skipped for this build."
        )
    return (
        f"Imagery resolves to {ortho.year}; LiDAR assets intersecting this AOI resolve to "
        "the NY_Columbia_Rensselaer_2016 3DEP project on Planetary Computer."
    )


def get_vector_envelope(path: Path) -> tuple[float, float, float, float]:
    dataset = ogr.Open(str(path))
    if dataset is None:
        raise RuntimeError(f"Unable to open vector dataset {path}")
    layer = dataset.GetLayer(0)
    min_x, max_x, min_y, max_y = layer.GetExtent()
    layer = None
    dataset = None
    return float(min_x), float(min_y), float(max_x), float(max_y)


def run_pdal_pipeline(stages: list[dict[str, Any]], pipeline_path: Path) -> Path:
    ensure_directory(pipeline_path.parent)
    pipeline_path.write_text(json.dumps({"pipeline": stages}, indent=2), encoding="utf-8")
    result = subprocess.run(
        ["pdal", "pipeline", str(pipeline_path)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"PDAL pipeline failed for {pipeline_path.name}\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    return pipeline_path


def derive_lidar_preview_rasters_from_copc(
    *,
    raw_stage: dict[str, Any],
    work_root: Path,
    aligned_dir: Path,
    aoi_files: dict[str, Path],
    working_epsg: int,
    preview_resolution_m: float,
) -> dict[str, Path]:
    copc_records = raw_stage["lidar_downloads"].get("3dep-lidar-copc", [])
    copc_paths = [Path(record["local_path"]) for record in copc_records]
    if not copc_paths:
        raise RuntimeError("No COPC downloads are available for PDAL-derived preview rasters.")

    min_x, min_y, max_x, max_y = get_vector_envelope(aoi_files["buffered_utm"])
    bounds_string = f"([{min_x},{max_x}],[{min_y},{max_y}])"
    gdal_options = "TILED=YES,COMPRESS=DEFLATE,PREDICTOR=2,BIGTIFF=IF_SAFER"

    def build_base_stages() -> list[dict[str, Any]]:
        stages: list[dict[str, Any]] = [
            {
                "type": "readers.copc",
                "filename": str(copc_path),
            }
            for copc_path in copc_paths
        ]
        if len(copc_paths) > 1:
            stages.append({"type": "filters.merge"})
        stages.extend([
            {"type": "filters.reprojection", "out_srs": f"EPSG:{working_epsg}"},
            {"type": "filters.crop", "bounds": bounds_string},
        ])
        return stages

    derived_specs = [
        {
            "key": "3dep-lidar-dtm",
            "filename": aligned_dir / "dtm_preview_grid.tif",
            "filters": [{"type": "filters.expression", "expression": "Classification == 2"}],
            "dimension": "Z",
            "output_type": "min",
            "data_type": "float32",
        },
        {
            "key": "3dep-lidar-dsm",
            "filename": aligned_dir / "dsm_preview_grid.tif",
            "filters": [],
            "dimension": "Z",
            "output_type": "max",
            "data_type": "float32",
        },
        {
            "key": "3dep-lidar-intensity",
            "filename": aligned_dir / "intensity_preview_grid.tif",
            "filters": [],
            "dimension": "Intensity",
            "output_type": "mean",
            "data_type": "float32",
        },
        {
            "key": "3dep-lidar-classification",
            "filename": aligned_dir / "classification_preview_grid.tif",
            "filters": [],
            "dimension": "Classification",
            "output_type": "max",
            "data_type": "uint16",
        },
    ]

    aligned_paths: dict[str, Path] = {}
    for spec in derived_specs:
        if spec["filename"].exists():
            aligned_paths[spec["key"]] = spec["filename"]
            continue
        log(f"Deriving {spec['key']} from raw COPC using PDAL")
        pipeline_stages = [
            *build_base_stages(),
            *spec["filters"],
            {
                "type": "writers.gdal",
                "filename": str(spec["filename"]),
                "resolution": preview_resolution_m,
                "bounds": bounds_string,
                "dimension": spec["dimension"],
                "output_type": spec["output_type"],
                "data_type": spec["data_type"],
                "nodata": 0,
                "gdalopts": gdal_options,
            },
        ]
        run_pdal_pipeline(pipeline_stages, work_root / f"derive_{spec['key']}.json")
        aligned_paths[spec["key"]] = spec["filename"]

    hag_path = aligned_dir / "hag_preview_grid.tif"
    if not hag_path.exists():
        log("Deriving 3dep-lidar-hag from raw COPC using PDAL")
        run_pdal_pipeline(
            [
                *build_base_stages(),
                {"type": "filters.hag_dem", "raster": str(aligned_paths["3dep-lidar-dtm"])},
                {
                    "type": "writers.gdal",
                    "filename": str(hag_path),
                    "resolution": preview_resolution_m,
                    "bounds": bounds_string,
                    "dimension": "HeightAboveGround",
                    "output_type": "max",
                    "data_type": "float32",
                    "nodata": 0,
                    "gdalopts": gdal_options,
                },
            ],
            work_root / "derive_3dep-lidar-hag.json",
        )
    aligned_paths["3dep-lidar-hag"] = hag_path
    return aligned_paths


def write_public_site_twin_package(
    *,
    public_root: Path,
    public_base_url: str,
    derived_stage: dict[str, Any],
    ortho: OrthoDownload | None,
    terrain_only: bool,
) -> Path:
    public_root = ensure_directory(public_root)
    public_base_url = public_base_url.rstrip("/")

    copy_file(Path(derived_stage["surface_png_path"]), public_root / "terrain_surface.png")
    copy_file(Path(derived_stage["surface_tif_path"]), public_root / "terrain_surface.tif")
    copy_file(Path(derived_stage["grave_candidates_geojson"]), public_root / "grave_candidates.geojson")

    manifest = {
        "version": 1,
        "status": "ready",
        "mode": derived_stage["render_mode"],
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "terrainImage": {
            "url": f"{public_base_url}/terrain_surface.png",
            "bounds": derived_stage["surface_bounds_wgs84"],
            "opacity": 0.92 if terrain_only else 0.9,
            "pixelSizeMeters": derived_stage["preview_resolution_m"],
            "localPath": str(public_root / "terrain_surface.png"),
        },
        "graveCandidates": {
            "url": f"{public_base_url}/grave_candidates.geojson",
            "count": derived_stage["grave_candidate_count"],
            "knownHeadstoneCount": derived_stage["grave_candidate_summary"]["known_headstone_count"],
        },
        "sourceVintageNote": build_source_vintage_note(ortho, terrain_only=terrain_only),
        "metrics": {
            **derived_stage["preview_summary"]["preview_metrics"],
            "graveCandidateCount": derived_stage["grave_candidate_count"],
            "graveCandidateHeightP95M": derived_stage["grave_candidate_summary"]["height_p95_m"],
        },
    }
    manifest_path = public_root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path


def build_aligned_derivatives(
    *,
    aoi: AoiContext,
    raw_stage: dict[str, Any],
    lidar_assets: dict[str, list[dict[str, Any]]],
    work_root: Path,
    derived_root: Path,
    aoi_files: dict[str, Path],
    working_epsg: int,
    preview_resolution_m: float,
    headstone_buffer_m: float,
    terrain_only: bool,
) -> dict[str, str]:
    work_root = ensure_directory(work_root)
    preview_dir = ensure_directory(derived_root / "preview")
    aligned_dir = ensure_directory(preview_dir / "aligned")
    preview_work_dir = ensure_directory(work_root / "preview")
    metadata_dir = ensure_directory(derived_root / "metadata")

    derivative_sources: dict[str, list[str]] = {}
    has_staged_derivative_rasters = True
    for collection in ["3dep-lidar-dtm", "3dep-lidar-dsm", "3dep-lidar-hag", "3dep-lidar-intensity", "3dep-lidar-classification"]:
        records = raw_stage["lidar_downloads"].get(collection, [])
        derivative_sources[collection] = [
            record["local_path"]
            for record in records
            if record.get("local_path")
        ]
        if not derivative_sources[collection]:
            has_staged_derivative_rasters = False

    aligned_paths: dict[str, Path] = {}
    if has_staged_derivative_rasters:
        try:
            for collection, sources in derivative_sources.items():
                vrt_path = build_vrt(sources, work_root / f"{collection}.vrt")
                aligned_path = aligned_dir / f"{collection.replace('3dep-lidar-', '')}_preview_grid.tif"
                warp_raster(
                    vrt_path,
                    aligned_path,
                    dst_epsg=working_epsg,
                    cutline_path=aoi_files["buffered_utm"],
                    x_res=preview_resolution_m,
                    y_res=preview_resolution_m,
                    resample_alg="near" if collection == "3dep-lidar-classification" else "bilinear",
                    dst_nodata=0,
                )
                aligned_paths[collection] = aligned_path
        except RuntimeError as error:
            log(
                "Falling back to PDAL-derived preview rasters from raw COPC because the staged "
                f"3DEP derivative rasters could not be opened locally: {error}"
            )
            aligned_paths = derive_lidar_preview_rasters_from_copc(
                raw_stage=raw_stage,
                work_root=preview_work_dir,
                aligned_dir=aligned_dir,
                aoi_files=aoi_files,
                working_epsg=working_epsg,
                preview_resolution_m=preview_resolution_m,
            )
    else:
        log("Using PDAL-derived preview rasters from raw COPC because derivative raster downloads were skipped")
        aligned_paths = derive_lidar_preview_rasters_from_copc(
            raw_stage=raw_stage,
            work_root=preview_work_dir,
            aligned_dir=aligned_dir,
            aoi_files=aoi_files,
            working_epsg=working_epsg,
            preview_resolution_m=preview_resolution_m,
        )

    ortho_preview_path: Path | None = None
    template_path = aligned_paths["3dep-lidar-dtm"]
    if not terrain_only:
        ortho_zip_path_value = raw_stage.get("ortho_zip_path")
        if not ortho_zip_path_value:
            raise RuntimeError("Expected a staged ortho ZIP when terrain_only is false.")
        ortho_zip_path = Path(ortho_zip_path_value)
        ortho_vrt = build_vrt(
            collect_ortho_vsi_members(ortho_zip_path),
            work_root / "ortho_native.vrt",
        )
        ortho_preview_path = aligned_dir / "ortho_preview_grid.tif"
        warp_raster(
            ortho_vrt,
            ortho_preview_path,
            dst_epsg=working_epsg,
            cutline_path=aoi_files["buffered_utm"],
            x_res=preview_resolution_m,
            y_res=preview_resolution_m,
            resample_alg="cubic",
            dst_nodata=0,
        )
        aligned_paths["ortho"] = ortho_preview_path
        template_path = ortho_preview_path

    boundary_mask_path = preview_dir / "boundary_mask.tif"
    create_boundary_mask(template_path, aoi_files["exact_utm"], boundary_mask_path)

    anchor_mask_path = preview_dir / "headstone_anchor_mask.tif"
    build_headstone_anchor_mask(
        template_path,
        [Path(path) for path in HEADSTONE_SOURCES],
        anchor_mask_path,
        headstone_buffer_m=headstone_buffer_m,
    )

    ndsm_path = preview_dir / "ndsm_preview_grid.tif"
    build_ndsm(
        aligned_paths["3dep-lidar-dsm"],
        aligned_paths["3dep-lidar-dtm"],
        ndsm_path,
    )

    hillshade_path = build_multi_azimuth_hillshade(aligned_paths["3dep-lidar-dtm"], preview_work_dir)
    copied_hillshade_path = preview_dir / "hillshade_multi_azimuth.tif"
    gdal.Translate(str(copied_hillshade_path), str(hillshade_path))

    surface_tif_path = preview_dir / "terrain_surface.tif"
    surface_png_path = preview_dir / "terrain_surface.png"
    if terrain_only:
        preview_summary = build_terrain_only_preview(
            dtm_path=aligned_paths["3dep-lidar-dtm"],
            hillshade_path=copied_hillshade_path,
            ndsm_path=ndsm_path,
            hag_path=aligned_paths["3dep-lidar-hag"],
            intensity_path=aligned_paths["3dep-lidar-intensity"],
            classification_path=aligned_paths["3dep-lidar-classification"],
            boundary_mask_path=boundary_mask_path,
            anchor_mask_path=anchor_mask_path,
            output_tif_path=surface_tif_path,
            output_png_path=surface_png_path,
        )
    else:
        preview_summary = build_quasi_3d_preview(
            ortho_path=aligned_paths["ortho"],
            hillshade_path=copied_hillshade_path,
            ndsm_path=ndsm_path,
            hag_path=aligned_paths["3dep-lidar-hag"],
            intensity_path=aligned_paths["3dep-lidar-intensity"],
            boundary_mask_path=boundary_mask_path,
            anchor_mask_path=anchor_mask_path,
            output_tif_path=surface_tif_path,
            output_png_path=surface_png_path,
        )

    grave_candidates_path = preview_dir / "grave_candidates.geojson"
    grave_candidate_summary = build_grave_candidate_geojson(
        aoi=aoi,
        ndsm_path=ndsm_path,
        hag_path=aligned_paths["3dep-lidar-hag"],
        classification_path=aligned_paths["3dep-lidar-classification"],
        output_path=grave_candidates_path,
    )
    surface_bounds_wgs84 = get_raster_bounds_wgs84(surface_tif_path)

    pdal_metadata_paths = []
    copc_dir = ensure_directory(metadata_dir / "copc")
    for record in raw_stage["lidar_downloads"].get("3dep-lidar-copc", []):
        copc_path = Path(record["local_path"])
        metadata_path = copc_dir / f"{copc_path.stem}.json"
        run_pdal_info(copc_path, metadata_path)
        pdal_metadata_paths.append(str(metadata_path))

    return {
        "ortho_preview_path": str(ortho_preview_path) if ortho_preview_path else "",
        "dtm_preview_path": str(aligned_paths["3dep-lidar-dtm"]),
        "dsm_preview_path": str(aligned_paths["3dep-lidar-dsm"]),
        "hag_preview_path": str(aligned_paths["3dep-lidar-hag"]),
        "intensity_preview_path": str(aligned_paths["3dep-lidar-intensity"]),
        "classification_preview_path": str(aligned_paths["3dep-lidar-classification"]),
        "boundary_mask_path": str(boundary_mask_path),
        "headstone_anchor_mask_path": str(anchor_mask_path),
        "hillshade_multi_path": str(copied_hillshade_path),
        "ndsm_preview_path": str(ndsm_path),
        "surface_tif_path": str(surface_tif_path),
        "surface_png_path": str(surface_png_path),
        "surface_bounds_wgs84": surface_bounds_wgs84,
        "grave_candidates_geojson": str(grave_candidates_path),
        "grave_candidate_count": grave_candidate_summary["count"],
        "grave_candidate_summary": grave_candidate_summary,
        "render_mode": "terrain-only" if terrain_only else "ortho-relief",
        "preview_resolution_m": preview_resolution_m,
        "pdal_metadata_paths": pdal_metadata_paths,
        "preview_summary": preview_summary,
    }


def build_manifest(
    *,
    output_root: Path,
    aoi: AoiContext,
    ortho: OrthoDownload | None,
    lidar_assets: dict[str, list[dict[str, Any]]],
    raw_stage: dict[str, Any],
    derived_stage: dict[str, Any] | None,
    aoi_files: dict[str, Path],
    args: argparse.Namespace,
    public_manifest_path: Path | None,
) -> Path:
    manifest_path = output_root / "manifest.json"

    collections_summary = {}
    for collection, items in lidar_assets.items():
        collections_summary[collection] = [
            {
                "item_id": item["id"],
                "bbox": item.get("bbox"),
                "original_href": get_original_asset_href(item),
            }
            for item in items
        ]

    manifest = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "aoi": {
            "path": str(aoi.aoi_path),
            "feature_count": aoi.feature_count,
            "aoi_hash": aoi.aoi_hash,
            "bbox_wgs84": list(aoi.bbox_wgs84),
            "centroid_wgs84": list(aoi.centroid_wgs84),
            "county": aoi.county,
            "municipality": aoi.municipality,
            "working_epsg": aoi.working_epsg,
        },
        "parameters": {
            "preview_resolution_m": args.preview_resolution_m,
            "buffer_m": args.buffer_m,
            "headstone_buffer_m": args.headstone_buffer_m,
            "metadata_only": args.metadata_only,
            "terrain_only": args.terrain_only,
            "public_root": str(Path(args.public_root)),
            "public_base_url": args.public_base_url,
        },
        "source_record": {
            "ortho_index_url": NYS_ORTHO_INDEX_URL,
            "ortho_county_page_url": ortho.county_page_url if ortho else None,
            "ortho_year": ortho.year if ortho else None,
            "ortho_resolution_note": ortho.resolution_note if ortho else None,
            "ortho_download_url": ortho.zip_url if ortho else None,
            "planetary_computer_dataset_url": PLANETARY_COMPUTER_DATASET_URL,
            "vintage_note": build_source_vintage_note(ortho, terrain_only=args.terrain_only),
        },
        "aoi_files": {key: str(value) for key, value in aoi_files.items()},
        "raw_stage": raw_stage,
        "lidar_items": collections_summary,
        "derived_stage": derived_stage,
        "public_package_manifest": str(public_manifest_path) if public_manifest_path else None,
    }

    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest_path


def main() -> int:
    args = parse_args()

    output_base = ensure_directory(Path(args.out))
    aoi = load_aoi_context(Path(args.aoi), args.county, args.municipality)
    site_root = ensure_directory(output_base / aoi.aoi_hash)
    raw_root = ensure_directory(site_root / "raw")
    work_root = ensure_directory(site_root / "work")
    derived_root = ensure_directory(site_root / "derived")

    log(f"Loaded AOI {aoi.aoi_path} with municipality '{aoi.municipality}'")
    log(f"Using working CRS EPSG:{aoi.working_epsg}")

    aoi_files = build_aoi_workspace(aoi, site_root, args.buffer_m)

    ortho: OrthoDownload | None = None
    if not args.terrain_only:
        ortho = resolve_ortho_download(aoi.county, aoi.municipality, args.ortho_year)
        log(f"Resolved ortho {ortho.year} download: {ortho.zip_url}")
    else:
        log("Skipping ortho resolution because --terrain-only was requested")

    lidar_assets = collect_lidar_assets(aoi.bbox_wgs84)
    if "3dep-lidar-copc" not in lidar_assets:
        raise RuntimeError("No intersecting COPC items were returned by the Planetary Computer STAC search.")
    log(
        "Resolved LiDAR collections: "
        + ", ".join(f"{collection}={len(items)}" for collection, items in sorted(lidar_assets.items()))
    )

    raw_stage = stage_raw_downloads(
        ortho,
        lidar_assets,
        raw_root=raw_root,
        force=args.force,
        metadata_only=args.metadata_only,
        download_derivative_collections=not args.terrain_only,
    )

    derived_stage = None
    public_manifest_path = None
    if not args.metadata_only:
        derived_stage = build_aligned_derivatives(
            aoi=aoi,
            raw_stage=raw_stage,
            lidar_assets=lidar_assets,
            work_root=work_root,
            derived_root=derived_root,
            aoi_files=aoi_files,
            working_epsg=aoi.working_epsg,
            preview_resolution_m=args.preview_resolution_m,
            headstone_buffer_m=args.headstone_buffer_m,
            terrain_only=args.terrain_only,
        )
        public_manifest_path = write_public_site_twin_package(
            public_root=Path(args.public_root),
            public_base_url=args.public_base_url,
            derived_stage=derived_stage,
            ortho=ortho,
            terrain_only=args.terrain_only,
        )
        log(f"Wrote static site twin package to {public_manifest_path}")

    manifest_path = build_manifest(
        output_root=site_root,
        aoi=aoi,
        ortho=ortho,
        lidar_assets=lidar_assets,
        raw_stage=raw_stage,
        derived_stage=derived_stage,
        aoi_files=aoi_files,
        args=args,
        public_manifest_path=public_manifest_path,
    )
    log(f"Wrote manifest to {manifest_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
