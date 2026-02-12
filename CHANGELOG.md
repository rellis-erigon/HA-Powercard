# Changelog

## [2.1.0] - 2026-02-12

### Fixed
- Circuit breaker labels corrected: Daily → "Todays Usage" heading, Current → "Amps", Power → "Wattage"
- Energy values now properly converted from Wh to kWh (divided by 1000, rounded to 0 decimal places)
- Device panels now show expanded by default on card load (collapsible if user clicks)
- Table headers properly aligned with device table data

### Added
- **Sub-devices**: Add devices under other devices (e.g., PC → Monitor, Speakers)
- **Monitored/Unmonitored totals**: Each breaker's device panel shows total monitored power and unmonitored difference
- **Auto-calculated average hourly**: Power history tracked in localStorage, Avg/Hr values calculated automatically without extra sensors
- **Auto-scaling breakers grid**: Card scales to full width, breakers distribute evenly across available space

### Improved
- Card now uses CSS custom property `--breaker-count` for responsive grid layout
- Better mobile responsiveness with 2-column layout on small screens
- Power history exposed via custom event `ha-powercard-averages` for external integrations

## [2.0.0] - 2026-02-12

### Added
- Complete visual editor - no YAML required
- Full GUI for adding/editing circuit breakers
- Full GUI for adding/editing devices per breaker
- Icon picker with 22 common device icons
- Color picker for accent color
- Battery support with state of charge display
- Professional design refresh

### Improved
- Better particle animations
- Refined typography and spacing
- Improved mobile layout
- Auto W→kW conversion for large values

## [1.0.0] - Initial Release

- Basic power flow visualization
- Solar, grid, battery sources
- Circuit breaker display
- Canvas-based animations
