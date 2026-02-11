# HA-Powercard

[![GitHub release](https://img.shields.io/github/v/release/rellis-erigon/HA-Powercard?style=flat-square)](https://github.com/rellis-erigon/HA-Powercard/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=flat-square)](https://hacs.xyz)

A novel Home Assistant Lovelace card that visualizes power distribution in a **physical distribution board** style, showing circuit breakers, animated power flows, and device-level consumption data.

![HA-Powercard Preview](docs/preview.gif)

## Features

- 🔌 **Distribution Board Layout** - Realistic electrical panel visualization
- ⚡ **Animated Power Flow** - Yellow animated lines showing real-time power movement
- 📊 **Circuit Breaker Details** - Daily totals (kWh), live current (A), and power (W)
- 🌞 **Solar Integration** - Display solar panel input with animated flow
- 🔋 **Grid Connection** - Show grid power import/export
- 📱 **Expandable Device Tables** - Click breakers to see connected devices
- 🎨 **Dark/Light Themes** - Automatic theme support
- 🖱️ **Interactive** - Click entities for more-info dialogs

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click the three dots menu → Custom repositories
3. Add `https://github.com/rellis-erigon/HA-Powercard` as a Lovelace repository
4. Search for "HA Powercard" and install
5. Refresh your browser

### Manual Installation

1. Download `ha-powercard.js` from the [latest release](https://github.com/rellis-erigon/HA-Powercard/releases)
2. Copy to your `config/www/` directory
3. Add the resource to your Lovelace configuration:

```yaml
resources:
  - url: /local/ha-powercard.js
    type: module
```

4. Restart Home Assistant

## Configuration

### Minimal Configuration

```yaml
type: custom:ha-powercard
title: My Distribution Board
solar:
  entity: sensor.solar_power
grid:
  entity: sensor.grid_power
main_breaker:
  entity_power: sensor.main_power
  entity_energy: sensor.main_energy_daily
  entity_current: sensor.main_current
circuit_breakers:
  - name: CB-1 Lights
    entity_power: sensor.lights_power
    entity_energy: sensor.lights_energy_daily
    entity_current: sensor.lights_current
```

### Full Configuration

```yaml
type: custom:ha-powercard
title: Distribution Board
theme: dark  # or 'light'
animation_speed: 2
show_solar: true
show_grid: true

solar:
  entity: sensor.solar_power
  name: Solar Panels

grid:
  entity: sensor.grid_power
  name: Grid

main_breaker:
  entity_power: sensor.main_power
  entity_energy: sensor.main_energy_daily
  entity_current: sensor.main_current
  name: Main CB

circuit_breakers:
  - name: CB-1 Kitchen
    entity_power: sensor.kitchen_power
    entity_energy: sensor.kitchen_energy_daily
    entity_current: sensor.kitchen_current
    devices:
      - name: Refrigerator
        icon: mdi:fridge
        entity: sensor.fridge_power
        entity_avg: sensor.fridge_avg_hourly
        entity_daily: sensor.fridge_energy_daily
      - name: Oven
        icon: mdi:stove
        entity: sensor.oven_power
        entity_avg: sensor.oven_avg_hourly
        entity_daily: sensor.oven_energy_daily

  - name: CB-2 Living Room
    entity_power: sensor.living_room_power
    entity_energy: sensor.living_room_energy_daily
    entity_current: sensor.living_room_current
    devices:
      - name: TV
        icon: mdi:television
        entity: sensor.tv_power
        entity_avg: sensor.tv_avg_hourly
        entity_daily: sensor.tv_energy_daily
      - name: Sound System
        icon: mdi:speaker
        entity: sensor.sound_power
        entity_avg: sensor.sound_avg_hourly
        entity_daily: sensor.sound_energy_daily

  - name: CB-3 Bedrooms
    entity_power: sensor.bedrooms_power
    entity_energy: sensor.bedrooms_energy_daily
    entity_current: sensor.bedrooms_current

  - name: CB-4 HVAC
    entity_power: sensor.hvac_power
    entity_energy: sensor.hvac_energy_daily
    entity_current: sensor.hvac_current

  - name: CB-5 Garage
    entity_power: sensor.garage_power
    entity_energy: sensor.garage_energy_daily
    entity_current: sensor.garage_current
    devices:
      - name: EV Charger
        icon: mdi:ev-station
        entity: sensor.ev_charger_power
        entity_avg: sensor.ev_charger_avg_hourly
        entity_daily: sensor.ev_charger_energy_daily
```

## Configuration Options

### Card Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | **required** | Must be `custom:ha-powercard` |
| `title` | string | `Distribution Board` | Title shown at top of the board |
| `theme` | string | `dark` | Theme: `dark` or `light` |
| `animation_speed` | number | `2` | Base animation speed in seconds |
| `show_solar` | boolean | `true` | Show solar panel box |
| `show_grid` | boolean | `true` | Show grid connection box |

### Solar Configuration

| Option | Type | Description |
|--------|------|-------------|
| `entity` | string | Power sensor entity (W or kW) |
| `name` | string | Display name (default: "Solar") |

### Grid Configuration

| Option | Type | Description |
|--------|------|-------------|
| `entity` | string | Power sensor entity (W or kW) |
| `name` | string | Display name (default: "Grid") |

### Main Breaker Configuration

| Option | Type | Description |
|--------|------|-------------|
| `entity_power` | string | Current power consumption (W) |
| `entity_energy` | string | Daily energy total (kWh) |
| `entity_current` | string | Current in amps (A) |
| `name` | string | Display name (default: "Main CB") |

### Circuit Breaker Configuration

Each circuit breaker in the `circuit_breakers` array can have:

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Breaker name (e.g., "CB-1 Kitchen") |
| `entity_power` | string | Current power consumption (W) |
| `entity_energy` | string | Daily energy total (kWh) |
| `entity_current` | string | Current in amps (A) |
| `devices` | array | List of devices on this circuit |

### Device Configuration

Each device in the `devices` array can have:

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Device name |
| `icon` | string | MDI icon (e.g., `mdi:fridge`) |
| `entity` | string | Current power sensor |
| `entity_avg` | string | Average hourly consumption sensor |
| `entity_daily` | string | Daily energy total sensor |

## Creating Required Sensors

You'll need sensors for power, energy, and current. Here are some examples:

### Using Template Sensors

```yaml
# configuration.yaml
template:
  - sensor:
      - name: "Main Power"
        unit_of_measurement: "W"
        state: "{{ states('sensor.smart_meter_power') | float(0) }}"
        
      - name: "Main Energy Daily"
        unit_of_measurement: "kWh"
        state: "{{ states('sensor.smart_meter_energy_daily') | float(0) }}"
        
      - name: "Main Current"
        unit_of_measurement: "A"
        state: "{{ (states('sensor.smart_meter_power') | float(0) / 240) | round(1) }}"
```

### Using Utility Meters

```yaml
# configuration.yaml
utility_meter:
  main_energy_daily:
    source: sensor.smart_meter_energy_total
    cycle: daily
```

## Screenshots

### Dark Theme
![Dark Theme](docs/dark-theme.png)

### Light Theme  
![Light Theme](docs/light-theme.png)

### Expanded Device Table
![Device Table](docs/devices-expanded.png)

## Animation Details

The yellow power flow lines animate based on actual power values:
- Higher power = faster animation
- Zero power = no animation
- Particles flow along the lines showing power direction

## Troubleshooting

### Card not appearing
1. Clear browser cache (Ctrl+F5)
2. Check browser console for errors (F12)
3. Verify the resource is loaded in Settings → Dashboards → Resources

### Entities not updating
1. Verify entity IDs are correct
2. Check entities have `unit_of_measurement` attribute
3. Ensure entities are not unavailable

### Animation performance
If animation is choppy, try:
1. Reducing the number of circuit breakers displayed
2. Increasing `animation_speed` value
3. Using a modern browser

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Credits

Inspired by:
- [Power Flow Card Plus](https://github.com/flixlix/power-flow-card-plus)
- [Sunsynk Power Flow Card](https://github.com/slipx06/sunsynk-power-flow-card)
- Real electrical distribution board designs

## Support

- 🐛 [Report bugs](https://github.com/rellis-erigon/HA-Powercard/issues)
- 💡 [Request features](https://github.com/rellis-erigon/HA-Powercard/issues)
- 📖 [Documentation](https://github.com/rellis-erigon/HA-Powercard/wiki)
