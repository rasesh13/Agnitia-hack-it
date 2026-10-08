"""Regional Climate & Numerical Weather Prediction (NWP) Downloader.
Fetches high-resolution hourly historical and forecast weather across India's
four primary renewable operating regions:
  1. western_desert (Jaipur, Rajasthan / Thar) - High GHI solar & dry winds
  2. southern_coastal (Tuticorin / Muppandal, Tamil Nadu) - World-class wind corridor
  3. northern_plains (Delhi NCR / Haryana) - Severe seasonal cooling/heating load swings
  4. deccan_plateau (Bengaluru / Pavagada, Karnataka) - Major hybrid solar-wind parks

Saves aligned weather data to:
  D:\\codes\\datasets for agnitia hack it\\regional_weather\\
"""
import json
import time
import urllib.request
from pathlib import Path
import pandas as pd

WEATHER_DIR = Path(r"D:\codes\datasets for agnitia hack it\regional_weather")
WEATHER_DIR.mkdir(parents=True, exist_ok=True)

REGIONS = {
    "western_desert_rajasthan": {
        "name": "Western Desert (Rajasthan / Thar Basin)",
        "lat": 26.9124,
        "lon": 75.7873,
        "solar_pv_capacity_kw": 250.0,
        "wind_capacity_kw": 100.0,
        "grid_emission_factor": 0.74,
    },
    "southern_coastal_tamilnadu": {
        "name": "Southern Coastal (Muppandal Wind Corridor)",
        "lat": 8.2560,
        "lon": 77.5450,
        "solar_pv_capacity_kw": 150.0,
        "wind_capacity_kw": 300.0,
        "grid_emission_factor": 0.68,
    },
    "northern_plains_delhincr": {
        "name": "Northern Plains (Delhi NCR / Haryana)",
        "lat": 28.6139,
        "lon": 77.2090,
        "solar_pv_capacity_kw": 200.0,
        "wind_capacity_kw": 50.0,
        "grid_emission_factor": 0.79,
    },
    "deccan_hybrid_karnataka": {
        "name": "Deccan Plateau (Pavagada Solar-Wind Park)",
        "lat": 14.1018,
        "lon": 77.2799,
        "solar_pv_capacity_kw": 350.0,
        "wind_capacity_kw": 150.0,
        "grid_emission_factor": 0.64,
    },
    "central_india_mp_indore": {
        "name": "Prestige University, Indore (Malwa Microgrid)",
        "lat": 22.7196,
        "lon": 75.8577,
        "solar_pv_capacity_kw": 300.0,
        "wind_capacity_kw": 120.0,
        "grid_emission_factor": 0.82,  # MP coal-dominant regional grid factor
    },
}


def fetch_regional_weather(region_id: str, cfg: dict, start_date: str = "2024-01-01", end_date: str = "2024-12-31") -> pd.DataFrame:
    """Fetch hourly temperature, GHI, DNI, wind speed, direction, and cloud cover from Open-Meteo."""
    out_file = WEATHER_DIR / f"{region_id}_weather_2024.parquet"
    if out_file.exists():
        print(f"[cached] {region_id} -> {out_file.name}")
        return pd.read_parquet(out_file)

    print(f"[fetch] Downloading 1-year NWP weather for {cfg['name']} ({cfg['lat']}, {cfg['lon']})...")
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={cfg['lat']}&longitude={cfg['lon']}&"
        f"start_date={start_date}&end_date={end_date}&"
        f"hourly=temperature_2m,relative_humidity_2m,direct_normal_irradiance,"
        f"diffuse_radiation,shortwave_radiation,wind_speed_10m,wind_direction_10m,cloud_cover"
    )

    req = urllib.request.Request(url, headers={"User-Agent": "AgnitiaVPP/2.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())

    hourly = data.get("hourly", {})
    df = pd.DataFrame(hourly)
    df["timestamp"] = pd.to_datetime(df["time"])
    df = df.drop(columns=["time"]).set_index("timestamp").sort_index()

    # Rename to standard engineering names
    df = df.rename(columns={
        "shortwave_radiation": "ghi_wm2",
        "direct_normal_irradiance": "dni_wm2",
        "diffuse_radiation": "dhi_wm2",
        "wind_speed_10m": "wind_speed_mps",
        "temperature_2m": "temp_c",
        "cloud_cover": "cloud_pct",
    })

    # Save to parquet
    df.to_parquet(out_file)
    print(f"[saved] {len(df):,} hours saved to {out_file}")
    return df


def main():
    # Save region registry
    with open(WEATHER_DIR / "regional_profiles.json", "w") as f:
        json.dump(REGIONS, f, indent=2)

    for r_id, cfg in REGIONS.items():
        try:
            fetch_regional_weather(r_id, cfg)
            time.sleep(1)  # polite API rate limiting
        except Exception as e:
            print(f"Error fetching {r_id}: {e}")

    print("\nRegional NWP Weather Archive successfully built in D:\\codes\\datasets for agnitia hack it\\regional_weather\\")


if __name__ == "__main__":
    main()
