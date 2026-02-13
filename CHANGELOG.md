# Changelog

All notable changes to this project will be documented in this file.

## [2.2.1] - 2026-02-13

### Changed
- **Device Panel Location**: Device panels now appear below all breaker cards instead of inline after each breaker
- Cleaner visual separation between breaker grid and device details

## [2.2.0] - 2026-02-13

### Fixed
- **Energy Value Conversion**: Values in Wh are now properly converted to kWh (÷1000, rounded to 0 decimal places)
- **Table Alignment**: Device table now has proper column widths (50% / 25% / 25%) with fixed layout

### Added
- **Monitored/Unmonitored Totals**: Device panel now shows:
  - ✓ Monitored Total (sum of all tracked devices)
  - ? Unmonitored (Breaker Total - Monitored)
  - Breaker Total (from breaker entity)
- **Sub-device Support**: Add sub-devices under any device via GUI editor (+Sub button)
- **Auto-scaling Layout**: Card and breakers automatically scale to fill available width
- **System-wide Averages**: Power averages exposed via:
  - `window.haPowercardAverages` global object
  - `ha-powercard-averages` custom event
  - localStorage key `ha-powercard-averages`
  - Includes hourly breakdown for last 24 hours

### Improved
- Responsive grid uses `auto-fit` with `minmax()` for optimal breaker sizing
- Better visual hierarchy in device tables with proper totals section

## [2.1.1] - 2026-02-13

### Fixed
- **Circuit Breaker Labels**: Updated labeling system:
  - "Daily" → "Today's Usage" 
  - Added "Live Data" section heading
  - "Current" → "Amps"
  - "Power" → "Wattage"
- **Devices Auto-Show**: Device panels now automatically expand when the card loads
- **Collapsible Devices**: Users can collapse/expand device panels by clicking the breaker card or collapse button
- **Energy Conversion**: Fixed Wh to kWh conversion displaying properly

### Improved
- Cleaner stat layout with proper dividers and section labels
- Better visual hierarchy in breaker cards
- More intuitive expand/collapse behavior

## [2.1.0] - 2026-02-12

### Added
- PowerHistoryTracker class for automatic hourly average calculations
- Sub-device support for nested device tracking
- Monitored vs unmonitored power totals per breaker
- Auto-scaling CSS grid layout based on breaker count
- Device daily averages in expanded panels

### Fixed
- Energy values now properly converted from Wh to kWh
- Table alignment in device panels
- Card scaling for full-width display

### Changed
- Devices now expand by default with collapse functionality
- Improved visual editor component

## [2.0.0] - 2026-02-11

### Added
- Initial distribution board style visualization
- Animated power flow on busbar
- Visual card editor for GUI configuration
- Solar, Grid, and Battery source boxes
- Main breaker with power/energy/current display
- Multiple circuit breaker support
- Expandable device tables per breaker
- Dark/light theme support
- HACS compatibility

## [1.0.0] - 2026-02-10

### Added
- Initial project setup
- Basic card structure
