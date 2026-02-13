/**
 * HA-Powercard v2.2.0
 * A Home Assistant custom card for visualizing electrical distribution board power flows
 * https://github.com/rellis-erigon/HA-Powercard
 * 
 * v2.2.0 Changes:
 * - Fixed energy display: Wh properly converted to kWh (÷1000, 0 decimal places)
 * - Added Monitored Total and Unmonitored (Breaker - Monitored) rows to device table
 * - Fixed table alignment with proper column widths
 * - Auto-scaling card width with breakers filling available space
 * - Sub-device support for nested device tracking
 * - PowerHistoryTracker exposes averages to Home Assistant via custom events
 */

// Power History Tracker - stores hourly averages in localStorage
class PowerHistoryTracker {
  constructor() {
    this.storageKey = 'ha-powercard-power-history';
    this.averagesKey = 'ha-powercard-averages';
    this.data = this._loadData();
    this._cleanOldData();
  }

  _loadData() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.warn('HA-Powercard: Could not load power history', e);
      return {};
    }
  }

  _saveData() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('HA-Powercard: Could not save power history', e);
    }
  }

  _cleanOldData() {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    let cleaned = false;
    for (const entityId in this.data) {
      for (const hourKey in this.data[entityId]) {
        if (parseInt(hourKey) < cutoff) {
          delete this.data[entityId][hourKey];
          cleaned = true;
        }
      }
    }
    if (cleaned) this._saveData();
  }

  recordPower(entityId, powerValue) {
    if (powerValue === null || isNaN(powerValue)) return;
    
    const now = new Date();
    const hourKey = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime();
    
    if (!this.data[entityId]) this.data[entityId] = {};
    if (!this.data[entityId][hourKey]) {
      this.data[entityId][hourKey] = { sum: 0, count: 0 };
    }
    
    this.data[entityId][hourKey].sum += powerValue;
    this.data[entityId][hourKey].count++;
    this._saveData();
  }

  getHourlyAverage(entityId, hoursAgo = 0) {
    const now = new Date();
    const targetHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - hoursAgo).getTime();
    
    if (this.data[entityId] && this.data[entityId][targetHour]) {
      const entry = this.data[entityId][targetHour];
      return entry.count > 0 ? entry.sum / entry.count : null;
    }
    return null;
  }

  getDailyAverage(entityId) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    let totalSum = 0;
    let totalCount = 0;
    
    if (this.data[entityId]) {
      for (const hourKey in this.data[entityId]) {
        if (parseInt(hourKey) >= startOfDay) {
          totalSum += this.data[entityId][hourKey].sum;
          totalCount += this.data[entityId][hourKey].count;
        }
      }
    }
    
    return totalCount > 0 ? totalSum / totalCount : null;
  }

  getAllHourlyAverages(entityId) {
    const averages = {};
    const now = new Date();
    
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i).getTime();
      const hourLabel = new Date(hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (this.data[entityId] && this.data[entityId][hour]) {
        const entry = this.data[entityId][hour];
        averages[hourLabel] = entry.count > 0 ? Math.round(entry.sum / entry.count) : null;
      } else {
        averages[hourLabel] = null;
      }
    }
    
    return averages;
  }

  exposeAverages() {
    const averages = {};
    
    for (const entityId in this.data) {
      averages[entityId] = {
        currentHour: this.getHourlyAverage(entityId, 0),
        lastHour: this.getHourlyAverage(entityId, 1),
        dailyAverage: this.getDailyAverage(entityId),
        hourlyBreakdown: this.getAllHourlyAverages(entityId)
      };
    }
    
    // Store in localStorage for other components
    try {
      localStorage.setItem(this.averagesKey, JSON.stringify({
        timestamp: Date.now(),
        averages: averages
      }));
    } catch (e) {
      console.warn('HA-Powercard: Could not save averages', e);
    }
    
    // Dispatch custom event for Home Assistant integration
    window.dispatchEvent(new CustomEvent('ha-powercard-averages', { 
      detail: averages,
      bubbles: true,
      composed: true
    }));
    
    // Also make available globally
    window.haPowercardAverages = averages;
    
    return averages;
  }

  // Static method to retrieve averages from anywhere
  static getStoredAverages() {
    try {
      const stored = localStorage.getItem('ha-powercard-averages');
      if (stored) {
        const data = JSON.parse(stored);
        // Check if data is less than 1 hour old
        if (Date.now() - data.timestamp < 3600000) {
          return data.averages;
        }
      }
    } catch (e) {
      console.warn('HA-Powercard: Could not retrieve averages', e);
    }
    return null;
  }
}

const powerHistory = new PowerHistoryTracker();

// Main Card Component
class HAPowercard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._expandedBreakers = new Set();
    this._animationFrame = null;
    this._particles = [];
    this._resizeObserver = null;
    this._initialRender = true;
  }

  set hass(hass) {
    this._hass = hass;
    this._recordPowerHistory();
    this._updateCard();
  }

  _recordPowerHistory() {
    if (!this._hass) return;
    
    this._config.circuit_breakers?.forEach(cb => {
      if (cb.entity_power) {
        const power = this._getEntityState(cb.entity_power);
        if (power !== null) powerHistory.recordPower(cb.entity_power, power);
      }
      
      cb.devices?.forEach(device => {
        if (device.entity) {
          const power = this._getEntityState(device.entity);
          if (power !== null) powerHistory.recordPower(device.entity, power);
        }
        // Record sub-devices
        device.sub_devices?.forEach(subDev => {
          if (subDev.entity) {
            const power = this._getEntityState(subDev.entity);
            if (power !== null) powerHistory.recordPower(subDev.entity, power);
          }
        });
      });
    });
    
    powerHistory.exposeAverages();
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    
    this._config = {
      title: 'Distribution Board',
      animation_speed: 2,
      show_solar: true,
      show_grid: true,
      show_battery: false,
      solar: { name: 'Solar' },
      grid: { name: 'Grid' },
      battery: { name: 'Battery' },
      main_breaker: { name: 'Main CB' },
      circuit_breakers: [],
      accent_color: '#f59e0b',
      ...config
    };
    
    // Auto-expand all breakers with devices on initial load
    if (this._initialRender) {
      this._config.circuit_breakers?.forEach((cb, index) => {
        if (cb.devices?.length > 0) {
          this._expandedBreakers.add(`cb-${index}`);
        }
      });
      this._initialRender = false;
    }
    
    this._render();
  }

  getCardSize() {
    return 4 + Math.ceil((this._config.circuit_breakers?.length || 0) / 4);
  }

  static getConfigElement() {
    return document.createElement('ha-powercard-editor');
  }

  static getStubConfig() {
    return {
      title: 'Distribution Board',
      animation_speed: 2,
      show_solar: true,
      show_grid: true,
      show_battery: false,
      accent_color: '#f59e0b',
      solar: { entity: '', name: 'Solar' },
      grid: { entity: '', name: 'Grid' },
      battery: { entity: '', entity_soc: '', name: 'Battery' },
      main_breaker: { entity_power: '', entity_energy: '', entity_current: '', name: 'Main CB' },
      circuit_breakers: []
    };
  }

  _getEntityState(entityId) {
    if (!this._hass || !entityId) return null;
    const state = this._hass.states[entityId];
    if (!state) return null;
    const val = parseFloat(state.state);
    return isNaN(val) ? null : val;
  }

  _getEntityUnit(entityId) {
    if (!this._hass || !entityId) return '';
    const state = this._hass.states[entityId];
    return state?.attributes?.unit_of_measurement || '';
  }

  _formatPower(value) {
    if (value === null || value === undefined) return '--';
    if (Math.abs(value) >= 1000) return (value / 1000).toFixed(2) + ' kW';
    return Math.round(value) + ' W';
  }

  _formatEnergy(value, entityId) {
    if (value === null || value === undefined) return '--';
    const unit = this._getEntityUnit(entityId);
    
    // Always convert to kWh - divide by 1000 and round to 0 decimal places
    if (unit === 'Wh' || (!unit && value >= 100)) {
      // Value is in Wh, convert to kWh
      return Math.round(value / 1000) + ' kWh';
    }
    // Already in kWh
    return Math.round(value) + ' kWh';
  }

  _formatCurrent(value) {
    if (value === null || value === undefined) return '--';
    return value.toFixed(1) + ' A';
  }

  _getStyles() {
    const accent = this._config.accent_color || '#f59e0b';
    const breakerCount = this._config.circuit_breakers?.length || 0;
    
    return `
      :host {
        --accent-color: ${accent};
        --accent-glow: ${accent}66;
        --breaker-count: ${breakerCount};
        display: block;
        width: 100%;
      }
      
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      .card {
        background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
        border-radius: 12px;
        padding: 16px;
        color: var(--primary-text-color, #e0e0e0);
        font-family: var(--ha-card-font-family, 'Segoe UI', sans-serif);
        position: relative;
        overflow: hidden;
        width: 100%;
      }
      
      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--divider-color, #333);
      }
      
      .card-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--primary-text-color, #fff);
      }
      
      .power-sources {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
      }
      
      .source-box {
        flex: 1;
        background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%);
        border: 1px solid var(--divider-color, #333);
        border-radius: 8px;
        padding: 12px;
        position: relative;
        overflow: hidden;
      }
      
      .source-box::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: var(--accent-color);
      }
      
      .source-box.solar::before {
        background: linear-gradient(90deg, #fbbf24, #f59e0b);
      }
      
      .source-box.grid::before {
        background: linear-gradient(90deg, #60a5fa, #3b82f6);
      }
      
      .source-box.battery::before {
        background: linear-gradient(90deg, #34d399, #10b981);
      }
      
      .source-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--secondary-text-color, #999);
        margin-bottom: 4px;
      }
      
      .source-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary-text-color, #fff);
      }
      
      .busbar-container {
        position: relative;
        height: 40px;
        margin: 16px 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .busbar {
        width: 100%;
        height: 12px;
        background: linear-gradient(180deg, #404040 0%, #2a2a2a 50%, #1a1a1a 100%);
        border-radius: 6px;
        position: relative;
        box-shadow: 
          inset 0 2px 4px rgba(0,0,0,0.5),
          0 2px 8px rgba(0,0,0,0.3);
      }
      
      .busbar::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 4px;
        right: 4px;
        height: 4px;
        background: linear-gradient(90deg, 
          transparent 0%,
          var(--accent-glow) 20%,
          var(--accent-color) 50%,
          var(--accent-glow) 80%,
          transparent 100%
        );
        border-radius: 2px;
        animation: busbar-flow 2s ease-in-out infinite;
      }
      
      @keyframes busbar-flow {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
      
      .main-breaker {
        background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
        border: 1px solid var(--divider-color, #333);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }
      
      .main-breaker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .main-breaker-name {
        font-size: 1rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .breaker-status {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #555;
        transition: all 0.3s ease;
      }
      
      .breaker-status.active {
        background: #22c55e;
        box-shadow: 0 0 8px #22c55e88;
      }
      
      .main-breaker-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
      }
      
      .stat-box {
        text-align: center;
        padding: 8px;
        background: rgba(0,0,0,0.2);
        border-radius: 6px;
      }
      
      .stat-label {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--secondary-text-color, #888);
        margin-bottom: 4px;
      }
      
      .stat-value {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--primary-text-color, #fff);
      }
      
      /* Auto-scaling breaker grid */
      .breakers-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        width: 100%;
      }
      
      /* For larger screens, limit to reasonable sizes */
      @media (min-width: 800px) {
        .breakers-grid {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }
      }
      
      @media (min-width: 1200px) {
        .breakers-grid {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
      }
      
      .breaker-card {
        background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
        border: 1px solid var(--divider-color, #333);
        border-radius: 8px;
        padding: 12px;
        transition: all 0.3s ease;
        min-width: 0;
      }
      
      .breaker-card.has-devices {
        cursor: pointer;
      }
      
      .breaker-card.has-devices:hover {
        border-color: var(--accent-color);
        box-shadow: 0 0 12px var(--accent-glow);
      }
      
      .breaker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .breaker-name {
        font-weight: 600;
        font-size: 0.9rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .breaker-stats {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.8rem;
      }
      
      .stat-item .stat-label {
        color: var(--secondary-text-color, #888);
        text-transform: none;
        letter-spacing: normal;
        font-size: 0.75rem;
        margin-bottom: 0;
      }
      
      .stat-item .stat-value {
        font-size: 0.85rem;
        font-weight: 500;
        font-family: 'SF Mono', 'Consolas', monospace;
      }
      
      .stat-divider {
        height: 1px;
        background: var(--divider-color, #333);
        margin: 6px 0;
      }
      
      .stat-section-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--accent-color);
        margin: 4px 0;
        font-weight: 600;
      }
      
      /* Device Panel - Full Width */
      .devices-panel {
        grid-column: 1 / -1;
        background: rgba(0,0,0,0.3);
        border-radius: 8px;
        padding: 12px;
        margin-top: 8px;
        overflow: hidden;
        transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
      }
      
      .devices-panel.collapsed {
        max-height: 0;
        padding: 0 12px;
        opacity: 0;
      }
      
      .devices-panel.expanded {
        max-height: 600px;
        opacity: 1;
      }
      
      .devices-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--divider-color, #444);
      }
      
      .devices-title {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--accent-color);
      }
      
      .collapse-btn {
        background: none;
        border: none;
        color: var(--secondary-text-color, #888);
        cursor: pointer;
        padding: 4px 8px;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .collapse-btn:hover {
        color: var(--accent-color);
      }
      
      /* Properly aligned table */
      .devices-table {
        width: 100%;
        font-size: 0.8rem;
        border-collapse: collapse;
        table-layout: fixed;
      }
      
      .devices-table th,
      .devices-table td {
        padding: 8px 12px;
        vertical-align: middle;
      }
      
      .devices-table th {
        text-align: left;
        font-weight: 600;
        color: var(--secondary-text-color, #888);
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 2px solid var(--divider-color, #444);
      }
      
      .devices-table th:nth-child(1) {
        width: 50%;
        text-align: left;
      }
      
      .devices-table th:nth-child(2),
      .devices-table th:nth-child(3) {
        width: 25%;
        text-align: right;
      }
      
      .devices-table td {
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      
      .devices-table td:nth-child(1) {
        text-align: left;
      }
      
      .devices-table td:nth-child(2),
      .devices-table td:nth-child(3) {
        text-align: right;
        font-family: 'SF Mono', 'Consolas', monospace;
      }
      
      .device-row td {
        color: var(--primary-text-color, #e0e0e0);
      }
      
      .device-row.sub-device td:first-child {
        padding-left: 28px;
        color: var(--secondary-text-color, #999);
        position: relative;
      }
      
      .device-row.sub-device td:first-child::before {
        content: '└';
        position: absolute;
        left: 12px;
        color: var(--divider-color, #555);
      }
      
      /* Totals rows */
      .totals-section td {
        border-top: 2px solid var(--divider-color, #444);
        padding-top: 10px;
      }
      
      .totals-row td {
        font-weight: 600;
        padding-top: 6px;
        padding-bottom: 6px;
      }
      
      .totals-row.monitored td {
        color: var(--accent-color);
      }
      
      .totals-row.monitored td:first-child::before {
        content: '✓ ';
      }
      
      .totals-row.unmonitored td {
        color: var(--secondary-text-color, #888);
        font-style: italic;
      }
      
      .totals-row.unmonitored td:first-child::before {
        content: '? ';
      }
      
      .totals-row.breaker-total td {
        color: var(--primary-text-color, #fff);
        border-top: 1px solid var(--divider-color, #444);
      }
    `;
  }

  _renderMainBreaker() {
    const config = this._config.main_breaker || {};
    const power = this._getEntityState(config.entity_power);
    const energy = this._getEntityState(config.entity_energy);
    const current = this._getEntityState(config.entity_current);
    
    return `
      <div class="main-breaker">
        <div class="main-breaker-header">
          <span class="main-breaker-name">
            ${config.name || 'Main CB'}
            <span class="breaker-status ${power > 0 ? 'active' : ''}"></span>
          </span>
        </div>
        <div class="main-breaker-stats">
          <div class="stat-box">
            <div class="stat-label">Today's Usage</div>
            <div class="stat-value">${this._formatEnergy(energy, config.entity_energy)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Amps</div>
            <div class="stat-value">${this._formatCurrent(current)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Wattage</div>
            <div class="stat-value">${this._formatPower(power)}</div>
          </div>
        </div>
      </div>
    `;
  }

  _renderCircuitBreaker(cb, index) {
    const power = this._getEntityState(cb.entity_power);
    const energy = this._getEntityState(cb.entity_energy);
    const current = this._getEntityState(cb.entity_current);
    const hasDevices = cb.devices?.length > 0;
    const breakerId = `cb-${index}`;
    const isExpanded = this._expandedBreakers.has(breakerId);
    
    return `
      <div class="breaker-card ${hasDevices ? 'has-devices' : ''}" 
           data-breaker="${breakerId}" 
           data-has-devices="${hasDevices}">
        <div class="breaker-header">
          <span class="breaker-name">${cb.name || 'CB-' + (index + 1)}</span>
          <span class="breaker-status ${power > 0 ? 'active' : ''}"></span>
        </div>
        <div class="breaker-stats">
          <div class="stat-item">
            <span class="stat-label">Today's Usage</span>
            <span class="stat-value">${this._formatEnergy(energy, cb.entity_energy)}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-section-label">Live Data</div>
          <div class="stat-item">
            <span class="stat-label">Amps</span>
            <span class="stat-value">${this._formatCurrent(current)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Wattage</span>
            <span class="stat-value">${this._formatPower(power)}</span>
          </div>
        </div>
      </div>
      ${hasDevices ? this._renderDevicesPanel(cb, breakerId, isExpanded) : ''}
    `;
  }

  _renderDevicesPanel(cb, breakerId, isExpanded) {
    let monitoredPower = 0;
    const breakerTotalPower = this._getEntityState(cb.entity_power) || 0;
    
    // Build device rows and calculate monitored total
    const deviceRows = cb.devices.map(device => {
      const power = this._getEntityState(device.entity);
      const avgPower = device.entity ? powerHistory.getDailyAverage(device.entity) : null;
      
      if (power !== null) monitoredPower += power;
      
      let rows = `
        <tr class="device-row">
          <td>${device.name || 'Device'}</td>
          <td>${this._formatPower(power)}</td>
          <td>${avgPower !== null ? this._formatPower(avgPower) : '--'}</td>
        </tr>
      `;
      
      // Sub-devices
      if (device.sub_devices?.length > 0) {
        device.sub_devices.forEach(subDev => {
          const subPower = this._getEntityState(subDev.entity);
          const subAvg = subDev.entity ? powerHistory.getDailyAverage(subDev.entity) : null;
          
          // Note: sub-device power is typically already included in parent device
          // Only add to monitored if it's a separate measurement
          if (subDev.separate_measurement && subPower !== null) {
            monitoredPower += subPower;
          }
          
          rows += `
            <tr class="device-row sub-device">
              <td>${subDev.name || 'Sub-device'}</td>
              <td>${this._formatPower(subPower)}</td>
              <td>${subAvg !== null ? this._formatPower(subAvg) : '--'}</td>
            </tr>
          `;
        });
      }
      
      return rows;
    }).join('');
    
    const unmonitoredPower = Math.max(0, breakerTotalPower - monitoredPower);
    
    return `
      <div class="devices-panel ${isExpanded ? 'expanded' : 'collapsed'}" data-panel="${breakerId}">
        <div class="devices-header">
          <span class="devices-title">${cb.name} — Devices</span>
          <button class="collapse-btn" data-toggle="${breakerId}">
            ${isExpanded ? '▲ Collapse' : '▼ Expand'}
          </button>
        </div>
        <table class="devices-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Wattage</th>
              <th>Avg (Today)</th>
            </tr>
          </thead>
          <tbody>
            ${deviceRows}
          </tbody>
          <tbody class="totals-section">
            <tr class="totals-row monitored">
              <td>Monitored Total</td>
              <td>${this._formatPower(monitoredPower)}</td>
              <td>--</td>
            </tr>
            <tr class="totals-row unmonitored">
              <td>Unmonitored</td>
              <td>${this._formatPower(unmonitoredPower)}</td>
              <td>--</td>
            </tr>
            <tr class="totals-row breaker-total">
              <td>Breaker Total</td>
              <td>${this._formatPower(breakerTotalPower)}</td>
              <td>--</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  _renderCircuitBreakers() {
    const breakers = this._config.circuit_breakers || [];
    return breakers.map((cb, index) => this._renderCircuitBreaker(cb, index)).join('');
  }

  _renderPowerSources() {
    const sources = [];
    
    if (this._config.show_solar) {
      const solarPower = this._getEntityState(this._config.solar?.entity);
      sources.push(`
        <div class="source-box solar">
          <div class="source-label">${this._config.solar?.name || 'Solar'}</div>
          <div class="source-value">${this._formatPower(solarPower)}</div>
        </div>
      `);
    }
    
    if (this._config.show_grid) {
      const gridPower = this._getEntityState(this._config.grid?.entity);
      sources.push(`
        <div class="source-box grid">
          <div class="source-label">${this._config.grid?.name || 'Grid'}</div>
          <div class="source-value">${this._formatPower(gridPower)}</div>
        </div>
      `);
    }
    
    if (this._config.show_battery) {
      const batteryPower = this._getEntityState(this._config.battery?.entity);
      const batterySoc = this._getEntityState(this._config.battery?.entity_soc);
      sources.push(`
        <div class="source-box battery">
          <div class="source-label">${this._config.battery?.name || 'Battery'}${batterySoc !== null ? ` (${Math.round(batterySoc)}%)` : ''}</div>
          <div class="source-value">${this._formatPower(batteryPower)}</div>
        </div>
      `);
    }
    
    return sources.join('');
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${this._getStyles()}</style>
      <div class="card">
        <div class="card-header">
          <span class="card-title">${this._config.title || 'Distribution Board'}</span>
        </div>
        
        <div class="power-sources">
          ${this._renderPowerSources()}
        </div>
        
        <div class="busbar-container">
          <div class="busbar"></div>
        </div>
        
        ${this._renderMainBreaker()}
        
        <div class="breakers-grid">
          ${this._renderCircuitBreakers()}
        </div>
      </div>
    `;
    
    this._attachEventListeners();
  }

  _attachEventListeners() {
    // Breaker card clicks
    this.shadowRoot.querySelectorAll('.breaker-card.has-devices').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.collapse-btn')) return;
        const breakerId = card.dataset.breaker;
        this._toggleDevices(breakerId);
      });
    });
    
    // Collapse button clicks
    this.shadowRoot.querySelectorAll('.collapse-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const breakerId = btn.dataset.toggle;
        this._toggleDevices(breakerId);
      });
    });
  }

  _toggleDevices(breakerId) {
    const panel = this.shadowRoot.querySelector(`[data-panel="${breakerId}"]`);
    const btn = this.shadowRoot.querySelector(`[data-toggle="${breakerId}"]`);
    
    if (!panel) return;
    
    if (this._expandedBreakers.has(breakerId)) {
      this._expandedBreakers.delete(breakerId);
      panel.classList.remove('expanded');
      panel.classList.add('collapsed');
      if (btn) btn.textContent = '▼ Expand';
    } else {
      this._expandedBreakers.add(breakerId);
      panel.classList.remove('collapsed');
      panel.classList.add('expanded');
      if (btn) btn.textContent = '▲ Collapse';
    }
  }

  _updateCard() {
    if (!this.shadowRoot.querySelector('.card')) {
      this._render();
      return;
    }
    
    // Update power sources
    const solarValue = this.shadowRoot.querySelector('.source-box.solar .source-value');
    const gridValue = this.shadowRoot.querySelector('.source-box.grid .source-value');
    const batteryValue = this.shadowRoot.querySelector('.source-box.battery .source-value');
    
    if (solarValue) {
      solarValue.textContent = this._formatPower(this._getEntityState(this._config.solar?.entity));
    }
    if (gridValue) {
      gridValue.textContent = this._formatPower(this._getEntityState(this._config.grid?.entity));
    }
    if (batteryValue) {
      batteryValue.textContent = this._formatPower(this._getEntityState(this._config.battery?.entity));
    }
    
    // Update main breaker
    const mainConfig = this._config.main_breaker || {};
    const mainPower = this._getEntityState(mainConfig.entity_power);
    const mainEnergy = this._getEntityState(mainConfig.entity_energy);
    const mainCurrent = this._getEntityState(mainConfig.entity_current);
    
    const mainBreaker = this.shadowRoot.querySelector('.main-breaker');
    if (mainBreaker) {
      const status = mainBreaker.querySelector('.breaker-status');
      if (status) status.className = `breaker-status ${mainPower > 0 ? 'active' : ''}`;
      
      const statBoxes = mainBreaker.querySelectorAll('.stat-box .stat-value');
      if (statBoxes[0]) statBoxes[0].textContent = this._formatEnergy(mainEnergy, mainConfig.entity_energy);
      if (statBoxes[1]) statBoxes[1].textContent = this._formatCurrent(mainCurrent);
      if (statBoxes[2]) statBoxes[2].textContent = this._formatPower(mainPower);
    }
    
    // Update circuit breakers - need to re-render for device panel updates
    this._config.circuit_breakers?.forEach((cb, index) => {
      const card = this.shadowRoot.querySelector(`[data-breaker="cb-${index}"]`);
      if (!card) return;
      
      const power = this._getEntityState(cb.entity_power);
      const energy = this._getEntityState(cb.entity_energy);
      const current = this._getEntityState(cb.entity_current);
      
      const status = card.querySelector('.breaker-status');
      if (status) status.className = `breaker-status ${power > 0 ? 'active' : ''}`;
      
      const values = card.querySelectorAll('.stat-item .stat-value');
      if (values[0]) values[0].textContent = this._formatEnergy(energy, cb.entity_energy);
      if (values[1]) values[1].textContent = this._formatCurrent(current);
      if (values[2]) values[2].textContent = this._formatPower(power);
      
      // Update device panel if expanded
      const panel = this.shadowRoot.querySelector(`[data-panel="cb-${index}"]`);
      if (panel && this._expandedBreakers.has(`cb-${index}`)) {
        const breakerId = `cb-${index}`;
        const isExpanded = this._expandedBreakers.has(breakerId);
        const newPanelHtml = this._renderDevicesPanel(cb, breakerId, isExpanded);
        
        // Create temp container to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = newPanelHtml;
        const newPanel = temp.firstElementChild;
        
        // Only update table content to preserve expand state
        const oldTable = panel.querySelector('.devices-table');
        const newTable = newPanel.querySelector('.devices-table');
        if (oldTable && newTable) {
          oldTable.innerHTML = newTable.innerHTML;
        }
      }
    });
  }
}

// Visual Editor Component
class HAPowercardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._editingBreaker = null;
    this._editingDevice = null;
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
        }
        
        .editor-section {
          margin-bottom: 24px;
          background: var(--ha-card-background, #1c1c1c);
          border-radius: 8px;
          padding: 16px;
        }
        
        .section-title {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 16px;
          color: var(--primary-text-color, #fff);
          border-bottom: 1px solid var(--divider-color, #333);
          padding-bottom: 8px;
        }
        
        .form-group {
          margin-bottom: 12px;
        }
        
        label {
          display: block;
          font-size: 0.85rem;
          color: var(--secondary-text-color, #888);
          margin-bottom: 4px;
        }
        
        input, select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--divider-color, #333);
          border-radius: 6px;
          background: var(--card-background-color, #2a2a2a);
          color: var(--primary-text-color, #fff);
          font-size: 0.9rem;
        }
        
        input:focus, select:focus {
          outline: none;
          border-color: var(--accent-color, #f59e0b);
        }
        
        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .checkbox-group input[type="checkbox"] {
          width: auto;
        }
        
        .entity-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        
        .breakers-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .breaker-item {
          background: rgba(0,0,0,0.2);
          border-radius: 6px;
          padding: 12px;
        }
        
        .breaker-item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        
        .breaker-item-header input {
          flex: 1;
        }
        
        .devices-list {
          margin-top: 8px;
          padding-left: 12px;
          border-left: 2px solid var(--divider-color, #333);
        }
        
        .device-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
        }
        
        .device-item input {
          flex: 1;
        }
        
        .sub-device-item {
          padding-left: 16px;
          opacity: 0.8;
        }
        
        .sub-device-item::before {
          content: '└ ';
          color: var(--divider-color, #555);
        }
        
        button {
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s ease;
        }
        
        button.primary {
          background: var(--accent-color, #f59e0b);
          color: #000;
        }
        
        button.secondary {
          background: var(--divider-color, #333);
          color: var(--primary-text-color, #fff);
        }
        
        button.danger {
          background: #ef4444;
          color: #fff;
          padding: 4px 8px;
        }
        
        button.small {
          padding: 4px 8px;
          font-size: 0.75rem;
        }
        
        button:hover {
          opacity: 0.8;
        }
        
        .add-btn {
          margin-top: 8px;
        }
      </style>
      
      <div class="editor-section">
        <div class="section-title">General Settings</div>
        <div class="form-group">
          <label>Card Title</label>
          <input type="text" id="title" value="${this._config.title || 'Distribution Board'}" />
        </div>
        <div class="form-group">
          <label>Accent Color</label>
          <input type="color" id="accent_color" value="${this._config.accent_color || '#f59e0b'}" />
        </div>
        <div class="form-group checkbox-group">
          <input type="checkbox" id="show_solar" ${this._config.show_solar !== false ? 'checked' : ''} />
          <label for="show_solar">Show Solar</label>
        </div>
        <div class="form-group checkbox-group">
          <input type="checkbox" id="show_grid" ${this._config.show_grid !== false ? 'checked' : ''} />
          <label for="show_grid">Show Grid</label>
        </div>
        <div class="form-group checkbox-group">
          <input type="checkbox" id="show_battery" ${this._config.show_battery ? 'checked' : ''} />
          <label for="show_battery">Show Battery</label>
        </div>
      </div>
      
      <div class="editor-section">
        <div class="section-title">Solar Configuration</div>
        <div class="entity-grid">
          <div class="form-group">
            <label>Power Entity</label>
            <input type="text" id="solar_entity" value="${this._config.solar?.entity || ''}" placeholder="sensor.solar_power" />
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" id="solar_name" value="${this._config.solar?.name || 'Solar'}" />
          </div>
        </div>
      </div>
      
      <div class="editor-section">
        <div class="section-title">Grid Configuration</div>
        <div class="entity-grid">
          <div class="form-group">
            <label>Power Entity</label>
            <input type="text" id="grid_entity" value="${this._config.grid?.entity || ''}" placeholder="sensor.grid_power" />
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" id="grid_name" value="${this._config.grid?.name || 'Grid'}" />
          </div>
        </div>
      </div>
      
      <div class="editor-section">
        <div class="section-title">Main Breaker Configuration</div>
        <div class="form-group">
          <label>Name</label>
          <input type="text" id="main_name" value="${this._config.main_breaker?.name || 'Main CB'}" />
        </div>
        <div class="entity-grid">
          <div class="form-group">
            <label>Power Entity</label>
            <input type="text" id="main_power" value="${this._config.main_breaker?.entity_power || ''}" />
          </div>
          <div class="form-group">
            <label>Energy Entity</label>
            <input type="text" id="main_energy" value="${this._config.main_breaker?.entity_energy || ''}" />
          </div>
          <div class="form-group">
            <label>Current Entity</label>
            <input type="text" id="main_current" value="${this._config.main_breaker?.entity_current || ''}" />
          </div>
        </div>
      </div>
      
      <div class="editor-section">
        <div class="section-title">Circuit Breakers</div>
        <div class="breakers-list" id="breakers-list">
          ${this._renderBreakersList()}
        </div>
        <button class="primary add-btn" id="add-breaker">+ Add Circuit Breaker</button>
      </div>
    `;
    
    this._attachEditorListeners();
  }

  _renderBreakersList() {
    const breakers = this._config.circuit_breakers || [];
    if (breakers.length === 0) {
      return '<p style="color: var(--secondary-text-color); font-size: 0.85rem;">No circuit breakers configured.</p>';
    }
    
    return breakers.map((cb, index) => `
      <div class="breaker-item" data-index="${index}">
        <div class="breaker-item-header">
          <input type="text" value="${cb.name || 'CB-' + (index + 1)}" data-field="name" data-breaker="${index}" />
          <button class="danger small" data-action="delete-breaker" data-index="${index}">✕</button>
        </div>
        <div class="entity-grid">
          <div class="form-group">
            <label>Power Entity</label>
            <input type="text" value="${cb.entity_power || ''}" data-field="entity_power" data-breaker="${index}" placeholder="sensor.power" />
          </div>
          <div class="form-group">
            <label>Energy Entity</label>
            <input type="text" value="${cb.entity_energy || ''}" data-field="entity_energy" data-breaker="${index}" placeholder="sensor.energy" />
          </div>
          <div class="form-group">
            <label>Current Entity</label>
            <input type="text" value="${cb.entity_current || ''}" data-field="entity_current" data-breaker="${index}" placeholder="sensor.current" />
          </div>
        </div>
        <div class="devices-list">
          <label style="font-weight: 600; margin-bottom: 8px; display: block;">Devices</label>
          ${this._renderDevicesList(cb.devices || [], index)}
          <button class="secondary small add-btn" data-action="add-device" data-breaker="${index}">+ Add Device</button>
        </div>
      </div>
    `).join('');
  }

  _renderDevicesList(devices, breakerIndex) {
    if (devices.length === 0) {
      return '<p style="color: var(--secondary-text-color); font-size: 0.75rem; margin: 4px 0;">No devices</p>';
    }
    
    return devices.map((device, deviceIndex) => `
      <div class="device-item" data-breaker="${breakerIndex}" data-device="${deviceIndex}">
        <input type="text" value="${device.name || ''}" data-field="device-name" placeholder="Device name" />
        <input type="text" value="${device.entity || ''}" data-field="device-entity" placeholder="sensor.device_power" style="flex: 1.5;" />
        <button class="secondary small" data-action="add-subdevice" data-breaker="${breakerIndex}" data-device="${deviceIndex}">+Sub</button>
        <button class="danger small" data-action="delete-device" data-breaker="${breakerIndex}" data-device="${deviceIndex}">✕</button>
      </div>
      ${this._renderSubDevicesList(device.sub_devices || [], breakerIndex, deviceIndex)}
    `).join('');
  }

  _renderSubDevicesList(subDevices, breakerIndex, deviceIndex) {
    return subDevices.map((subDev, subIndex) => `
      <div class="device-item sub-device-item" data-breaker="${breakerIndex}" data-device="${deviceIndex}" data-subdevice="${subIndex}">
        <input type="text" value="${subDev.name || ''}" data-field="subdevice-name" placeholder="Sub-device name" />
        <input type="text" value="${subDev.entity || ''}" data-field="subdevice-entity" placeholder="sensor.subdevice_power" style="flex: 1.5;" />
        <button class="danger small" data-action="delete-subdevice" data-breaker="${breakerIndex}" data-device="${deviceIndex}" data-subdevice="${subIndex}">✕</button>
      </div>
    `).join('');
  }

  _attachEditorListeners() {
    // General settings
    ['title', 'accent_color', 'show_solar', 'show_grid', 'show_battery'].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) {
        el.addEventListener('change', (e) => {
          const value = el.type === 'checkbox' ? el.checked : el.value;
          this._updateConfig(id, value);
        });
      }
    });
    
    // Solar config
    ['solar_entity', 'solar_name'].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this._updateConfig('solar', {
            ...this._config.solar,
            entity: this.shadowRoot.getElementById('solar_entity').value,
            name: this.shadowRoot.getElementById('solar_name').value
          });
        });
      }
    });
    
    // Grid config
    ['grid_entity', 'grid_name'].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this._updateConfig('grid', {
            ...this._config.grid,
            entity: this.shadowRoot.getElementById('grid_entity').value,
            name: this.shadowRoot.getElementById('grid_name').value
          });
        });
      }
    });
    
    // Main breaker config
    ['main_name', 'main_power', 'main_energy', 'main_current'].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          this._updateConfig('main_breaker', {
            ...this._config.main_breaker,
            name: this.shadowRoot.getElementById('main_name').value,
            entity_power: this.shadowRoot.getElementById('main_power').value,
            entity_energy: this.shadowRoot.getElementById('main_energy').value,
            entity_current: this.shadowRoot.getElementById('main_current').value
          });
        });
      }
    });
    
    // Add breaker button
    const addBreakerBtn = this.shadowRoot.getElementById('add-breaker');
    if (addBreakerBtn) {
      addBreakerBtn.addEventListener('click', () => {
        const breakers = [...(this._config.circuit_breakers || [])];
        breakers.push({ name: `CB-${breakers.length + 1}`, devices: [] });
        this._updateConfig('circuit_breakers', breakers);
        this._render();
      });
    }
    
    // Breaker field changes
    this.shadowRoot.querySelectorAll('[data-breaker][data-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const breakerIndex = parseInt(input.dataset.breaker);
        const field = input.dataset.field;
        const breakers = [...(this._config.circuit_breakers || [])];
        breakers[breakerIndex] = { ...breakers[breakerIndex], [field]: input.value };
        this._updateConfig('circuit_breakers', breakers);
      });
    });
    
    // Device field changes
    this.shadowRoot.querySelectorAll('.device-item:not(.sub-device-item)').forEach(item => {
      const breakerIndex = parseInt(item.dataset.breaker);
      const deviceIndex = parseInt(item.dataset.device);
      
      const nameInput = item.querySelector('[data-field="device-name"]');
      const entityInput = item.querySelector('[data-field="device-entity"]');
      
      [nameInput, entityInput].forEach(input => {
        if (input) {
          input.addEventListener('change', () => {
            const breakers = [...(this._config.circuit_breakers || [])];
            const devices = [...(breakers[breakerIndex].devices || [])];
            devices[deviceIndex] = {
              ...devices[deviceIndex],
              name: nameInput.value,
              entity: entityInput.value
            };
            breakers[breakerIndex] = { ...breakers[breakerIndex], devices };
            this._updateConfig('circuit_breakers', breakers);
          });
        }
      });
    });
    
    // Sub-device field changes
    this.shadowRoot.querySelectorAll('.sub-device-item').forEach(item => {
      const breakerIndex = parseInt(item.dataset.breaker);
      const deviceIndex = parseInt(item.dataset.device);
      const subIndex = parseInt(item.dataset.subdevice);
      
      const nameInput = item.querySelector('[data-field="subdevice-name"]');
      const entityInput = item.querySelector('[data-field="subdevice-entity"]');
      
      [nameInput, entityInput].forEach(input => {
        if (input) {
          input.addEventListener('change', () => {
            const breakers = [...(this._config.circuit_breakers || [])];
            const devices = [...(breakers[breakerIndex].devices || [])];
            const subDevices = [...(devices[deviceIndex].sub_devices || [])];
            subDevices[subIndex] = {
              ...subDevices[subIndex],
              name: nameInput.value,
              entity: entityInput.value
            };
            devices[deviceIndex] = { ...devices[deviceIndex], sub_devices: subDevices };
            breakers[breakerIndex] = { ...breakers[breakerIndex], devices };
            this._updateConfig('circuit_breakers', breakers);
          });
        }
      });
    });
    
    // Action buttons
    this.shadowRoot.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const breakerIndex = parseInt(btn.dataset.breaker || btn.dataset.index);
        const deviceIndex = parseInt(btn.dataset.device);
        const subIndex = parseInt(btn.dataset.subdevice);
        
        const breakers = [...(this._config.circuit_breakers || [])];
        
        switch (action) {
          case 'delete-breaker':
            breakers.splice(breakerIndex, 1);
            this._updateConfig('circuit_breakers', breakers);
            this._render();
            break;
            
          case 'add-device':
            const devices = [...(breakers[breakerIndex].devices || [])];
            devices.push({ name: '', entity: '', sub_devices: [] });
            breakers[breakerIndex] = { ...breakers[breakerIndex], devices };
            this._updateConfig('circuit_breakers', breakers);
            this._render();
            break;
            
          case 'delete-device':
            const devs = [...(breakers[breakerIndex].devices || [])];
            devs.splice(deviceIndex, 1);
            breakers[breakerIndex] = { ...breakers[breakerIndex], devices: devs };
            this._updateConfig('circuit_breakers', breakers);
            this._render();
            break;
            
          case 'add-subdevice':
            const parentDevices = [...(breakers[breakerIndex].devices || [])];
            const subDevices = [...(parentDevices[deviceIndex].sub_devices || [])];
            subDevices.push({ name: '', entity: '' });
            parentDevices[deviceIndex] = { ...parentDevices[deviceIndex], sub_devices: subDevices };
            breakers[breakerIndex] = { ...breakers[breakerIndex], devices: parentDevices };
            this._updateConfig('circuit_breakers', breakers);
            this._render();
            break;
            
          case 'delete-subdevice':
            const pDevices = [...(breakers[breakerIndex].devices || [])];
            const sDevices = [...(pDevices[deviceIndex].sub_devices || [])];
            sDevices.splice(subIndex, 1);
            pDevices[deviceIndex] = { ...pDevices[deviceIndex], sub_devices: sDevices };
            breakers[breakerIndex] = { ...breakers[breakerIndex], devices: pDevices };
            this._updateConfig('circuit_breakers', breakers);
            this._render();
            break;
        }
      });
    });
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    }));
  }
}

// Register components
customElements.define('ha-powercard', HAPowercard);
customElements.define('ha-powercard-editor', HAPowercardEditor);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-powercard',
  name: 'HA-Powercard',
  description: 'A distribution board style power monitoring card with animated flows',
  preview: true
});

// Expose PowerHistoryTracker for external access
window.HAPowercardHistory = PowerHistoryTracker;

console.info(
  '%c HA-POWERCARD %c v2.2.0 ',
  'color: white; background: #f59e0b; font-weight: bold; padding: 2px 6px; border-radius: 4px 0 0 4px;',
  'color: #f59e0b; background: #1c1c1c; font-weight: bold; padding: 2px 6px; border-radius: 0 4px 4px 0;'
);
