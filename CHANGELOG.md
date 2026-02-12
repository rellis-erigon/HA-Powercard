# Changelog

All notable changes to HA-Powercard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-11

### Added
- **Complete Visual Editor** — Full GUI configuration, no YAML required
- **Circuit Breaker Management** — Add/edit/delete breakers through the UI
- **Device Management** — Add devices to breakers with icon picker
- **Battery Support** — Display battery power and state of charge
- **Customizable Accent Color** — Color picker for busbar and highlights
- **Improved Animations** — Smoother particle flow with better performance
- **Professional Design Refresh** — Cleaner, more polished interface
- **Responsive Layout** — Better mobile and tablet support

### Changed
- Redesigned card layout with improved visual hierarchy
- Better source cards with accent borders
- Improved busbar glow effect
- Smoother animation rendering with ResizeObserver
- Better entity picker integration in editor
- Auto-format large watt values to kW

### Fixed
- Animation canvas sizing issues
- Entity picker state synchronization
- Theme compatibility improvements

## [1.0.0] - 2026-02-11

### Added
- Initial release
- Distribution board style visualization
- Animated power flow lines using canvas
- Solar and grid power source display
- Main circuit breaker with power/energy/current data
- Multiple circuit breakers support
- Expandable device tables per circuit breaker
- Basic visual editor
- Dark and light theme support
- HACS compatibility

## [Unreleased]

### Planned
- Power export visualization (bidirectional grid flow)
- Multiple solar inputs
- Circuit breaker trip status indicators
- Historical usage mini-charts
- Cost calculation display
- Drag-and-drop breaker reordering
