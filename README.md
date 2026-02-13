# ⚡ HA-Powercard

A Home Assistant custom card that visualizes your electrical distribution board with professional power monitoring aesthetics.

![Version](https://img.shields.io/badge/version-2.1.1-orange)
![HACS](https://img.shields.io/badge/HACS-Custom-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Distribution Board Layout** - Realistic electrical panel visualization
- **Animated Power Flow** - Glowing busbar shows live power flow
- **Multiple Sources** - Solar, Grid, and Battery monitoring
- **Circuit Breakers** - Individual breaker cards with live stats
- **Device Tracking** - Expandable device tables per breaker with sub-device support
- **Auto-Calculated Averages** - Hourly/daily averages calculated from power history
- **Visual Editor** - Full GUI configuration in Home Assistant
- **Theme Support** - Works with dark and light themes

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click the three dots menu → Custom repositories
3. Add `https://github.com/rellis-erigon/HA-Powercard` as type "Lovelace"
4. Search for "HA-Powercard" and install
5. Refresh your browser

### Manual Installation

1. Download `ha-powercard.js` from the `dist` folder
2. Copy to `/config/www/ha-powercard.js`
3. Add the resource in Home Assistant:
   - Settings → Dashboards → Resources
   - Add `/local/ha-powercard.js` as JavaScript Module

## Configuration

### Using the Visual Editor

1. Add a new card to your dashboard
2. Search for "HA-Powercard"
3. Configure using the GUI editor

### YAML Configuration

```yaml
type: custom:ha-powercard
title: Distribution Board
accent_color: '#f59e0b'
show_solar: true
show_grid: true
show_battery: false

solar:
  entity: sensor.solar_power
  name: Solar

grid:
  entity: sensor.grid_power
  name: Grid

battery:
  entity: sensor.battery_power
  entity_soc: sensor.battery_soc
  name: Battery

main_breaker:
  name: Main CB
  entity_power: sensor.main_power
  entity_energy: sensor.main_energy_daily
  entity_current: sensor.main_current

circuit_breakers:
  - name: Kitchen
    entity_power: sensor.kitchen_power
    entity_energy: sensor.kitchen_energy_daily
    entity_current: sensor.kitchen_current
    devices:
      - name: Refrigerator
        entity: sensor.fridge_power
      - name: Oven
        entity: sensor.oven_power
        sub_devices:
          - name: Oven Fan
            entity: sensor.oven_fan_power
      - name: Microwave
        entity: sensor.microwave_power

  - name: Living Room
    entity_power: sensor.living_power
    entity_energy: sensor.living_energy_daily
    entity_current: sensor.living_current
    devices:
      - name: TV
        entity: sensor.tv_power
      - name: Sound System
        entity: sensor.audio_power

  - name: Bedrooms
    entity_power: sensor.bedroom_power
    entity_energy: sensor.bedroom_energy_daily
    entity_current: sensor.bedroom_current
```

## Card Labels

Each circuit breaker displays:

| Label | Description |
|-------|-------------|
| **Today's Usage** | Daily energy consumption (kWh) |
| **Live Data** | Section heading for real-time values |
| **Amps** | Current draw in Amperes |
| **Wattage** | Power consumption in Watts |

## Device Panels

- Devices **auto-expand** when the card loads
- Click a breaker card to **collapse/expand** its devices
- Each device shows current wattage and daily average
- **Monitored Total** shows sum of tracked devices
- **Unmonitored** shows difference (breaker total - monitored)

## Power History

The card automatically tracks power readings using localStorage:
- Calculates hourly averages
- Calculates daily averages
- Data retained for 7 days
- Exposed via `ha-powercard-averages` custom event

## Styling

Customize the accent color:

```yaml
accent_color: '#f59e0b'  # Amber (default)
accent_color: '#22c55e'  # Green
accent_color: '#3b82f6'  # Blue
accent_color: '#ef4444'  # Red
```

## Requirements

- Home Assistant 2023.1 or newer
- Power sensors (W or kW)
- Energy sensors (Wh or kWh) - optional
- Current sensors (A) - optional

## Support

- [GitHub Issues](https://github.com/rellis-erigon/HA-Powercard/issues)
- [Changelog](CHANGELOG.md)

## License

MIT License - see [LICENSE](LICENSE) for details.
