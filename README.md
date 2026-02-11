# HA-Powercard v2.0

[![GitHub release](https://img.shields.io/github/v/release/rellis-erigon/HA-Powercard?style=flat-square)](https://github.com/rellis-erigon/HA-Powercard/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![HACS](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=flat-square)](https://hacs.xyz)

A Home Assistant Lovelace card that visualizes power distribution in a **physical distribution board** style with **full GUI configuration** — no YAML required!

![HA-Powercard Preview](docs/preview.png)

## ✨ What's New in v2.0

- 🎛️ **Complete Visual Editor** — Configure everything through the GUI
- ➕ **Add/Remove Circuit Breakers** — Manage breakers without touching YAML
- 📱 **Add/Remove Devices** — Assign devices to each breaker visually
- 🔋 **Battery Support** — Show battery with state of charge
- 🎨 **Professional Design** — Refined, modern interface
- ⚡ **Improved Animations** — Smoother, more realistic power flow
- 🌈 **Customizable Accent Color** — Match your dashboard theme

## Features

- 🔌 **Distribution Board Layout** — Realistic electrical panel visualization
- ⚡ **Animated Power Flow** — Particle animations showing real-time power movement
- 📊 **Circuit Breaker Details** — Daily totals (kWh), live current (A), and power (W)
- 🌞 **Solar Integration** — Display solar panel input with animated flow
- 🔋 **Battery Integration** — Show battery power and state of charge
- 🔌 **Grid Connection** — Show grid power import/export
- 📱 **Expandable Device Tables** — Click breakers to see connected devices
- 🎨 **Theme Support** — Works with light and dark themes

## Installation

### HACS (Recommended)

1. Open HACS in Home Assistant
2. Click the three dots menu → **Custom repositories**
3. Add `https://github.com/rellis-erigon/HA-Powercard` as a **Lovelace** repository
4. Search for "HA Powercard" and install
5. Refresh your browser (Ctrl+F5)

### Manual Installation

1. Download `ha-powercard.js` from the [latest release](https://github.com/rellis-erigon/HA-Powercard/releases)
2. Copy to your `config/www/` directory
3. Add the resource in Home Assistant:
   - Settings → Dashboards → Three dots → Resources
   - Add `/local/ha-powercard.js` as JavaScript Module
4. Refresh your browser

## Quick Start

1. Go to your dashboard and click **Edit**
2. Click **+ Add Card**
3. Search for **"HA Powercard"**
4. Use the **Visual Editor** to configure:
   - General settings (title, accent color)
   - Power sources (solar, battery, grid)
   - Main breaker entities
   - Circuit breakers and devices

That's it! No YAML needed.

## Visual Editor Guide

### General Tab
- **Card Title** — Name shown at the top
- **Accent Color** — Primary color for the busbar and highlights
- **Animation Speed** — How fast particles flow (lower = faster)

### Power Sources Tab
- Toggle **Solar**, **Grid**, and **Battery** on/off
- Set display names and entities for each source
- Battery supports a separate State of Charge entity

### Main Breaker Tab
- Configure the main circuit breaker
- Set Power (W), Energy (kWh daily), and Current (A) entities

### Circuit Breakers Tab
- Click **"Add Circuit Breaker"** to add new breakers
- Click the **edit icon** to configure each breaker
- Within each breaker, click **"Add Device"** to add connected devices
- Each device can have:
  - Name and icon
  - Power entity (current consumption)
  - Average hourly entity
  - Daily energy entity

## YAML Configuration (Optional)

While the GUI editor handles everything, you can also use YAML:

```yaml
type: custom:ha-powercard
title: My Power Board
accent_color: '#f59e0b'
animation_speed: 2
show_solar: true
show_grid: true
show_battery: true

solar:
  entity: sensor.solar_power
  name: Solar Panels

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

  - name: CB-2 Living Room
    entity_power: sensor.living_room_power
    entity_energy: sensor.living_room_energy_daily
    entity_current: sensor.living_room_current
```

## Configuration Reference

### Card Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `title` | string | `Distribution Board` | Title shown at top |
| `accent_color` | string | `#f59e0b` | Accent color (hex) |
| `animation_speed` | number | `2` | Animation speed (seconds) |
| `show_solar` | boolean | `true` | Show solar source |
| `show_grid` | boolean | `true` | Show grid source |
| `show_battery` | boolean | `false` | Show battery source |

### Source Configuration

**Solar / Grid:**
| Option | Type | Description |
|--------|------|-------------|
| `entity` | string | Power sensor entity |
| `name` | string | Display name |

**Battery:**
| Option | Type | Description |
|--------|------|-------------|
| `entity` | string | Power sensor entity |
| `entity_soc` | string | State of charge entity (%) |
| `name` | string | Display name |

### Breaker Configuration

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Breaker display name |
| `entity_power` | string | Current power (W) |
| `entity_energy` | string | Daily energy (kWh) |
| `entity_current` | string | Current (A) |
| `devices` | array | List of connected devices |

### Device Configuration

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Device name |
| `icon` | string | MDI icon (e.g., `mdi:fridge`) |
| `entity` | string | Current power sensor |
| `entity_avg` | string | Average hourly sensor |
| `entity_daily` | string | Daily energy sensor |

## Common Icons

```
mdi:fridge          mdi:stove           mdi:microwave
mdi:dishwasher      mdi:washing-machine mdi:tumble-dryer
mdi:television      mdi:desktop-tower   mdi:laptop
mdi:lamp            mdi:ceiling-light   mdi:fan
mdi:air-conditioner mdi:water-heater    mdi:ev-station
mdi:car-electric    mdi:speaker         mdi:printer
mdi:coffee-maker    mdi:toaster         mdi:power-plug
```

## Troubleshooting

### Card not appearing
1. Clear browser cache (Ctrl+F5 or Cmd+Shift+R)
2. Check browser console (F12) for errors
3. Verify the resource is loaded: Settings → Dashboards → Resources

### Entities not updating
1. Verify entity IDs are correct in Developer Tools → States
2. Check entities have `unit_of_measurement` attribute
3. Ensure entities are not `unavailable`

### Animation performance
- Increase `animation_speed` value for smoother performance on slower devices
- Reduce the number of circuit breakers if needed

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License — see [LICENSE](LICENSE) file for details.

## Support

- 🐛 [Report bugs](https://github.com/rellis-erigon/HA-Powercard/issues)
- 💡 [Request features](https://github.com/rellis-erigon/HA-Powercard/issues)
- ⭐ Star this repo if you find it useful!
