/**
 * HA-Powercard v2.0 - Distribution Board Power Flow Card for Home Assistant
 * Full GUI Editor + Professional Design
 * 
 * @version 2.0.0
 * @author rellis-erigon
 * @license MIT
 */

const CARD_VERSION = '2.0.0';

console.info(
  `%c HA-POWERCARD %c v${CARD_VERSION} `,
  'color: #fff; background: linear-gradient(135deg, #f59e0b, #d97706); font-weight: bold; padding: 4px 8px; border-radius: 6px 0 0 6px;',
  'color: #f59e0b; background: #1e1e2e; font-weight: bold; padding: 4px 8px; border-radius: 0 6px 6px 0;'
);

// ============================================================================
// MAIN CARD CLASS
// ============================================================================
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
  }

  set hass(hass) {
    this._hass = hass;
    this._updateCard();
  }

  setConfig(config) {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    
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
      theme: 'auto',
      accent_color: '#f59e0b',
      ...config
    };

    this._render();
  }

  getCardSize() {
    const baseSize = 4;
    const breakerRows = Math.ceil((this._config.circuit_breakers?.length || 0) / 4);
    return baseSize + breakerRows;
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
      solar: {
        entity: '',
        name: 'Solar',
      },
      grid: {
        entity: '',
        name: 'Grid',
      },
      battery: {
        entity: '',
        entity_soc: '',
        name: 'Battery',
      },
      main_breaker: {
        entity_power: '',
        entity_energy: '',
        entity_current: '',
        name: 'Main CB',
      },
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

  _formatValue(value, decimals = 1, unit = '') {
    if (value === null || value === undefined || isNaN(value)) return '—';
    
    // Auto-convert large watt values to kW
    if (unit === 'W' && Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)} kW`;
    }
    
    const formatted = Number(value).toFixed(decimals);
    return unit ? `${formatted} ${unit}` : formatted;
  }

  _render() {
    const styles = this._getStyles();
    const html = this._getHTML();
    
    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      ${html}
    `;

    this._setupEventListeners();
    this._setupCanvas();
    this._startAnimation();
  }

  _setupCanvas() {
    const canvas = this.shadowRoot.querySelector('.flow-canvas');
    if (!canvas) return;

    const container = this.shadowRoot.querySelector('.powercard-container');
    
    this._resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    });
    
    this._resizeObserver.observe(container);
  }

  _updateCard() {
    if (!this.shadowRoot.querySelector('.powercard-container')) {
      this._render();
      return;
    }

    // Update solar
    if (this._config.show_solar && this._config.solar?.entity) {
      const val = this._getEntityState(this._config.solar.entity);
      const el = this.shadowRoot.querySelector('.solar-value');
      if (el) el.textContent = this._formatValue(val, 0, 'W');
    }

    // Update grid
    if (this._config.show_grid && this._config.grid?.entity) {
      const val = this._getEntityState(this._config.grid.entity);
      const el = this.shadowRoot.querySelector('.grid-value');
      if (el) el.textContent = this._formatValue(val, 0, 'W');
    }

    // Update battery
    if (this._config.show_battery && this._config.battery?.entity) {
      const val = this._getEntityState(this._config.battery.entity);
      const soc = this._getEntityState(this._config.battery.entity_soc);
      const powerEl = this.shadowRoot.querySelector('.battery-value');
      const socEl = this.shadowRoot.querySelector('.battery-soc');
      if (powerEl) powerEl.textContent = this._formatValue(val, 0, 'W');
      if (socEl && soc !== null) socEl.textContent = `${Math.round(soc)}%`;
    }

    // Update main breaker
    this._updateBreakerData('main', this._config.main_breaker);

    // Update circuit breakers
    this._config.circuit_breakers?.forEach((cb, index) => {
      this._updateBreakerData(`cb-${index}`, cb);
    });

    // Update device tables
    this._updateDeviceTables();
  }

  _updateBreakerData(id, config) {
    if (!config) return;
    const container = this.shadowRoot.querySelector(`[data-breaker="${id}"]`);
    if (!container) return;

    const power = this._getEntityState(config.entity_power);
    const energy = this._getEntityState(config.entity_energy);
    const current = this._getEntityState(config.entity_current);

    const energyEl = container.querySelector('.breaker-energy');
    const currentEl = container.querySelector('.breaker-current');
    const powerEl = container.querySelector('.breaker-power');
    const statusEl = container.querySelector('.breaker-status');

    if (energyEl) energyEl.textContent = this._formatValue(energy, 2, 'kWh');
    if (currentEl) currentEl.textContent = this._formatValue(current, 1, 'A');
    if (powerEl) powerEl.textContent = this._formatValue(power, 0, 'W');
    if (statusEl) {
      statusEl.classList.toggle('active', power > 0);
    }
  }

  _updateDeviceTables() {
    this._config.circuit_breakers?.forEach((cb, cbIndex) => {
      if (!cb.devices?.length) return;
      
      cb.devices.forEach((device, devIndex) => {
        const row = this.shadowRoot.querySelector(`[data-device="${cbIndex}-${devIndex}"]`);
        if (!row) return;

        const power = this._getEntityState(device.entity);
        const avg = this._getEntityState(device.entity_avg);
        const daily = this._getEntityState(device.entity_daily);

        const powerEl = row.querySelector('.device-power');
        const avgEl = row.querySelector('.device-avg');
        const dailyEl = row.querySelector('.device-daily');

        if (powerEl) powerEl.textContent = this._formatValue(power, 0, 'W');
        if (avgEl) avgEl.textContent = this._formatValue(avg, 1, 'Wh');
        if (dailyEl) dailyEl.textContent = this._formatValue(daily, 2, 'kWh');
      });
    });
  }

  _startAnimation() {
    const canvas = this.shadowRoot.querySelector('.flow-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    const animate = () => {
      this._animationFrame = requestAnimationFrame(animate);
      
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      this._drawFlowLines(ctx, rect.width, rect.height);
      this._updateParticles(ctx);
    };

    animate();
  }

  _drawFlowLines(ctx, width, height) {
    const accentColor = this._config.accent_color || '#f59e0b';
    const solarPower = this._getEntityState(this._config.solar?.entity) || 0;
    const gridPower = this._getEntityState(this._config.grid?.entity) || 0;
    const batteryPower = this._getEntityState(this._config.battery?.entity) || 0;

    // Key positions
    const busbarY = height * 0.38;
    const sourceY = height * 0.12;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw glow effect for active lines
    const drawGlowLine = (path, power, color) => {
      if (power <= 0) return;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
      
      // Inner bright line
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    // Solar line
    if (this._config.show_solar && solarPower > 0) {
      const solarPath = [
        { x: width * 0.18, y: sourceY + 60 },
        { x: width * 0.18, y: busbarY },
        { x: width * 0.12, y: busbarY }
      ];
      drawGlowLine(solarPath, solarPower, '#fbbf24');
      this._addParticles('solar', solarPath, solarPower, '#fbbf24');
    }

    // Grid line
    if (this._config.show_grid && gridPower > 0) {
      const gridPath = [
        { x: width * 0.82, y: sourceY + 60 },
        { x: width * 0.82, y: busbarY },
        { x: width * 0.88, y: busbarY }
      ];
      drawGlowLine(gridPath, gridPower, '#6b7280');
      this._addParticles('grid', gridPath, gridPower, '#9ca3af');
    }

    // Battery line
    if (this._config.show_battery && Math.abs(batteryPower) > 0) {
      const batteryPath = [
        { x: width * 0.50, y: sourceY + 60 },
        { x: width * 0.50, y: busbarY }
      ];
      const batteryColor = batteryPower > 0 ? '#22c55e' : '#ef4444';
      drawGlowLine(batteryPath, Math.abs(batteryPower), batteryColor);
      this._addParticles('battery', batteryPath, Math.abs(batteryPower), batteryColor);
    }

    // Main busbar
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 6;
    
    const gradient = ctx.createLinearGradient(width * 0.08, 0, width * 0.92, 0);
    gradient.addColorStop(0, accentColor);
    gradient.addColorStop(0.5, '#fcd34d');
    gradient.addColorStop(1, accentColor);
    ctx.strokeStyle = gradient;
    
    ctx.beginPath();
    ctx.moveTo(width * 0.08, busbarY);
    ctx.lineTo(width * 0.92, busbarY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Vertical drops to breakers
    const breakerCount = (this._config.circuit_breakers?.length || 0) + 1;
    const startX = width * 0.10;
    const endX = width * 0.90;
    const spacing = (endX - startX) / Math.max(breakerCount, 1);

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 8;

    for (let i = 0; i < breakerCount; i++) {
      const x = startX + (i * spacing) + spacing / 2;
      ctx.beginPath();
      ctx.moveTo(x, busbarY);
      ctx.lineTo(x, busbarY + 20);
      ctx.stroke();
    }
    
    ctx.shadowBlur = 0;
  }

  _addParticles(source, path, power, color) {
    if (power <= 0) return;
    
    const speed = Math.max(0.008, 0.035 - (power / 8000) * 0.025);
    const existing = this._particles.filter(p => p.source === source);
    const maxParticles = Math.min(12, Math.ceil(power / 400));
    
    if (existing.length < maxParticles && Math.random() < 0.12) {
      this._particles.push({
        source,
        path: [...path],
        progress: 0,
        speed: speed * (0.7 + Math.random() * 0.6),
        size: 4 + Math.random() * 3,
        color
      });
    }
  }

  _updateParticles(ctx) {
    this._particles = this._particles.filter(particle => {
      particle.progress += particle.speed;
      if (particle.progress >= 1) return false;

      const pos = this._getPointOnPath(particle.path, particle.progress);
      
      // Glow
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, particle.size * 2, 0, Math.PI * 2);
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      
      // Core
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.9;
      ctx.fill();
      
      ctx.globalAlpha = 1;
      return true;
    });
  }

  _getPointOnPath(path, progress) {
    if (path.length < 2) return path[0] || { x: 0, y: 0 };

    let totalLength = 0;
    const segments = [];
    
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x;
      const dy = path[i].y - path[i-1].y;
      const length = Math.sqrt(dx * dx + dy * dy);
      segments.push({ start: path[i-1], end: path[i], length });
      totalLength += length;
    }

    const targetDistance = progress * totalLength;
    let currentDistance = 0;

    for (const segment of segments) {
      if (currentDistance + segment.length >= targetDistance) {
        const segmentProgress = (targetDistance - currentDistance) / segment.length;
        return {
          x: segment.start.x + (segment.end.x - segment.start.x) * segmentProgress,
          y: segment.start.y + (segment.end.y - segment.start.y) * segmentProgress
        };
      }
      currentDistance += segment.length;
    }

    return path[path.length - 1];
  }

  _setupEventListeners() {
    // Breaker expansion
    this.shadowRoot.querySelectorAll('.breaker-card[data-has-devices="true"]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.breaker;
        const panel = this.shadowRoot.querySelector(`[data-devices="${id}"]`);
        if (!panel) return;

        const isExpanded = this._expandedBreakers.has(id);
        if (isExpanded) {
          this._expandedBreakers.delete(id);
          panel.classList.remove('expanded');
          card.classList.remove('expanded');
        } else {
          this._expandedBreakers.add(id);
          panel.classList.add('expanded');
          card.classList.add('expanded');
        }
      });
    });

    // Entity click for more-info
    this.shadowRoot.querySelectorAll('[data-entity]').forEach(el => {
      const entityId = el.dataset.entity;
      if (!entityId) return;
      
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const event = new Event('hass-more-info', { bubbles: true, composed: true });
        event.detail = { entityId };
        this.dispatchEvent(event);
      });
    });
  }

  _getHTML() {
    const config = this._config;
    const accentColor = config.accent_color || '#f59e0b';
    
    return `
      <ha-card>
        <div class="powercard-container" style="--accent-color: ${accentColor}">
          <canvas class="flow-canvas"></canvas>
          
          <div class="card-header">
            <h2 class="card-title">${config.title || 'Distribution Board'}</h2>
          </div>

          <div class="power-sources">
            ${config.show_solar ? this._renderSourceCard('solar', config.solar, 'M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z', '#fbbf24') : ''}
            ${config.show_battery ? this._renderBatteryCard(config.battery) : ''}
            ${config.show_grid ? this._renderSourceCard('grid', config.grid, 'M8.28,5.45L6.5,4.55L7.76,2H16.24L17.5,4.55L15.72,5.45L15,4H9L8.28,5.45M18.62,8H14.09L13.3,5H10.7L9.91,8H5.38L4.1,10.55L5.89,11.44L6.62,10H17.38L18.1,11.44L19.89,10.55L18.62,8M17.77,22H15.7L15.46,21.21L12,14.82L8.54,21.21L8.3,22H6.23L9.12,15H5.38L4.1,12.55L5.89,11.64L6.62,13H17.38L18.1,11.64L19.89,12.55L18.62,15H14.88L17.77,22Z', '#6b7280') : ''}
          </div>

          <div class="distribution-board">
            <div class="board-inner">
              <div class="busbar"></div>
              <div class="breakers-grid">
                ${this._renderMainBreaker()}
                ${this._renderCircuitBreakers()}
              </div>
            </div>
          </div>

          ${this._renderDevicesPanels()}
        </div>
      </ha-card>
    `;
  }

  _renderSourceCard(type, config, iconPath, color) {
    const power = this._getEntityState(config?.entity);
    
    return `
      <div class="source-card ${type}-card" data-entity="${config?.entity || ''}" style="--source-color: ${color}">
        <div class="source-icon">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="${iconPath}"/></svg>
        </div>
        <div class="source-info">
          <span class="source-label">${config?.name || type}</span>
          <span class="source-value ${type}-value">${this._formatValue(power, 0, 'W')}</span>
        </div>
      </div>
    `;
  }

  _renderBatteryCard(config) {
    const power = this._getEntityState(config?.entity);
    const soc = this._getEntityState(config?.entity_soc);
    const isCharging = power < 0;
    const color = isCharging ? '#22c55e' : '#f59e0b';
    
    return `
      <div class="source-card battery-card" data-entity="${config?.entity || ''}" style="--source-color: ${color}">
        <div class="source-icon">
          <svg viewBox="0 0 24 24"><path fill="currentColor" d="M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z"/></svg>
          ${soc !== null ? `<span class="battery-soc">${Math.round(soc)}%</span>` : ''}
        </div>
        <div class="source-info">
          <span class="source-label">${config?.name || 'Battery'}</span>
          <span class="source-value battery-value">${this._formatValue(Math.abs(power), 0, 'W')}</span>
        </div>
      </div>
    `;
  }

  _renderMainBreaker() {
    const config = this._config.main_breaker || {};
    const power = this._getEntityState(config.entity_power);
    const energy = this._getEntityState(config.entity_energy);
    const current = this._getEntityState(config.entity_current);
    
    return `
      <div class="breaker-card main-breaker" data-breaker="main" data-has-devices="false">
        <div class="breaker-header">
          <span class="breaker-name">${config.name || 'Main CB'}</span>
          <span class="breaker-status ${power > 0 ? 'active' : ''}"></span>
        </div>
        <div class="breaker-stats">
          <div class="stat-item">
            <span class="stat-label">Daily</span>
            <span class="stat-value breaker-energy" data-entity="${config.entity_energy || ''}">${this._formatValue(energy, 2, 'kWh')}</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-label">Current</span>
            <span class="stat-value breaker-current" data-entity="${config.entity_current || ''}">${this._formatValue(current, 1, 'A')}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Power</span>
            <span class="stat-value breaker-power" data-entity="${config.entity_power || ''}">${this._formatValue(power, 0, 'W')}</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderCircuitBreakers() {
    const breakers = this._config.circuit_breakers || [];
    
    return breakers.map((cb, index) => {
      const power = this._getEntityState(cb.entity_power);
      const energy = this._getEntityState(cb.entity_energy);
      const current = this._getEntityState(cb.entity_current);
      const hasDevices = cb.devices?.length > 0;
      
      return `
        <div class="breaker-card ${hasDevices ? 'has-devices' : ''}" 
             data-breaker="cb-${index}" 
             data-has-devices="${hasDevices}">
          <div class="breaker-header">
            <span class="breaker-name">${cb.name || `CB-${index + 1}`}</span>
            <span class="breaker-status ${power > 0 ? 'active' : ''}"></span>
          </div>
          <div class="breaker-stats">
            <div class="stat-item">
              <span class="stat-label">Daily</span>
              <span class="stat-value breaker-energy" data-entity="${cb.entity_energy || ''}">${this._formatValue(energy, 2, 'kWh')}</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-label">Current</span>
              <span class="stat-value breaker-current" data-entity="${cb.entity_current || ''}">${this._formatValue(current, 1, 'A')}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Power</span>
              <span class="stat-value breaker-power" data-entity="${cb.entity_power || ''}">${this._formatValue(power, 0, 'W')}</span>
            </div>
          </div>
          ${hasDevices ? '<div class="expand-hint"><svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg></div>' : ''}
        </div>
      `;
    }).join('');
  }

  _renderDevicesPanels() {
    const breakers = this._config.circuit_breakers || [];
    
    const panels = breakers.map((cb, cbIndex) => {
      if (!cb.devices?.length) return '';
      
      return `
        <div class="devices-panel" data-devices="cb-${cbIndex}">
          <div class="devices-header">
            <span class="devices-title">${cb.name || `CB-${cbIndex + 1}`} — Connected Devices</span>
          </div>
          <div class="devices-table">
            <div class="table-header">
              <span>Device</span>
              <span>Avg/Hr</span>
              <span>Power</span>
              <span>Daily</span>
            </div>
            ${cb.devices.map((device, devIndex) => {
              const power = this._getEntityState(device.entity);
              const avg = this._getEntityState(device.entity_avg);
              const daily = this._getEntityState(device.entity_daily);
              
              return `
                <div class="table-row" data-device="${cbIndex}-${devIndex}" data-entity="${device.entity || ''}">
                  <span class="device-name">
                    ${device.icon ? `<ha-icon icon="${device.icon}"></ha-icon>` : '<ha-icon icon="mdi:power-plug"></ha-icon>'}
                    ${device.name || 'Device'}
                  </span>
                  <span class="device-avg">${this._formatValue(avg, 1, 'Wh')}</span>
                  <span class="device-power">${this._formatValue(power, 0, 'W')}</span>
                  <span class="device-daily">${this._formatValue(daily, 2, 'kWh')}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).filter(Boolean);

    return panels.length ? `<div class="devices-container">${panels.join('')}</div>` : '';
  }

  _getStyles() {
    return `
      :host {
        --card-bg: var(--ha-card-background, var(--card-background-color, #1e1e2e));
        --card-surface: var(--primary-background-color, #181825);
        --card-border: var(--divider-color, #313244);
        --text-primary: var(--primary-text-color, #cdd6f4);
        --text-secondary: var(--secondary-text-color, #a6adc8);
        --accent-color: #f59e0b;
      }

      ha-card {
        background: var(--card-bg);
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid var(--card-border);
      }

      .powercard-container {
        position: relative;
        padding: 20px;
        min-height: 420px;
      }

      .flow-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
      }

      /* Header */
      .card-header {
        position: relative;
        z-index: 2;
        margin-bottom: 16px;
      }

      .card-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 1.5px;
      }

      /* Power Sources */
      .power-sources {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 20px;
        position: relative;
        z-index: 2;
      }

      .source-card {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--card-surface);
        border: 1px solid var(--card-border);
        border-radius: 12px;
        padding: 14px 18px;
        cursor: pointer;
        transition: all 0.2s ease;
        max-width: 200px;
      }

      .source-card:hover {
        transform: translateY(-2px);
        border-color: var(--source-color);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      }

      .source-card.solar-card {
        border-left: 3px solid #fbbf24;
      }

      .source-card.grid-card {
        border-left: 3px solid #6b7280;
      }

      .source-card.battery-card {
        border-left: 3px solid var(--source-color);
      }

      .source-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: color-mix(in srgb, var(--source-color) 15%, transparent);
        color: var(--source-color);
        position: relative;
      }

      .source-icon svg {
        width: 24px;
        height: 24px;
      }

      .battery-soc {
        position: absolute;
        bottom: -6px;
        right: -6px;
        font-size: 9px;
        font-weight: 700;
        background: var(--card-bg);
        padding: 2px 4px;
        border-radius: 4px;
        color: var(--source-color);
      }

      .source-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .source-label {
        font-size: 11px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .source-value {
        font-size: 18px;
        font-weight: 700;
        color: var(--text-primary);
      }

      /* Distribution Board */
      .distribution-board {
        background: var(--card-surface);
        border: 1px solid var(--card-border);
        border-radius: 12px;
        padding: 16px;
        position: relative;
        z-index: 2;
      }

      .board-inner {
        position: relative;
      }

      .busbar {
        height: 6px;
        background: linear-gradient(90deg, 
          var(--accent-color) 0%, 
          color-mix(in srgb, var(--accent-color) 80%, #fff) 50%,
          var(--accent-color) 100%
        );
        border-radius: 3px;
        margin-bottom: 16px;
        box-shadow: 0 0 20px color-mix(in srgb, var(--accent-color) 50%, transparent);
      }

      .breakers-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;
      }

      /* Breaker Cards */
      .breaker-card {
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: 10px;
        padding: 12px;
        transition: all 0.2s ease;
        cursor: default;
      }

      .breaker-card.has-devices {
        cursor: pointer;
      }

      .breaker-card:hover {
        border-color: color-mix(in srgb, var(--accent-color) 50%, transparent);
      }

      .breaker-card.main-breaker {
        border-color: var(--accent-color);
        background: linear-gradient(135deg, 
          color-mix(in srgb, var(--accent-color) 8%, var(--card-bg)),
          var(--card-bg)
        );
      }

      .breaker-card.expanded {
        border-color: var(--accent-color);
      }

      .breaker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .breaker-name {
        font-size: 12px;
        font-weight: 700;
        color: var(--accent-color);
      }

      .breaker-status {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--card-border);
        transition: all 0.3s ease;
      }

      .breaker-status.active {
        background: #22c55e;
        box-shadow: 0 0 8px #22c55e;
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
      }

      .stat-label {
        font-size: 10px;
        color: var(--text-secondary);
      }

      .stat-value {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .stat-value[data-entity]:hover {
        color: var(--accent-color);
      }

      .stat-divider {
        height: 1px;
        background: var(--card-border);
        margin: 4px 0;
      }

      .expand-hint {
        display: flex;
        justify-content: center;
        margin-top: 8px;
        color: var(--text-secondary);
        opacity: 0.5;
        transition: all 0.2s ease;
      }

      .breaker-card.expanded .expand-hint {
        transform: rotate(180deg);
        opacity: 1;
        color: var(--accent-color);
      }

      /* Devices Container */
      .devices-container {
        margin-top: 16px;
        position: relative;
        z-index: 2;
      }

      .devices-panel {
        background: var(--card-surface);
        border: 1px solid var(--card-border);
        border-radius: 12px;
        padding: 0;
        margin-bottom: 12px;
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        transition: all 0.3s ease;
      }

      .devices-panel.expanded {
        padding: 16px;
        max-height: 500px;
        opacity: 1;
      }

      .devices-header {
        margin-bottom: 12px;
      }

      .devices-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--accent-color);
      }

      .devices-table {
        font-size: 12px;
      }

      .table-header {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr;
        gap: 12px;
        padding: 8px 12px;
        background: var(--card-bg);
        border-radius: 8px;
        margin-bottom: 6px;
        font-weight: 600;
        color: var(--text-secondary);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .table-row {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 8px;
        transition: background 0.2s ease;
        cursor: pointer;
      }

      .table-row:hover {
        background: var(--card-bg);
      }

      .device-name {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text-primary);
        font-weight: 500;
      }

      .device-name ha-icon {
        --mdc-icon-size: 18px;
        color: var(--text-secondary);
      }

      .device-avg,
      .device-power,
      .device-daily {
        color: var(--text-primary);
        text-align: right;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      /* Responsive */
      @media (max-width: 500px) {
        .powercard-container {
          padding: 14px;
        }

        .power-sources {
          flex-direction: column;
          gap: 10px;
        }

        .source-card {
          max-width: none;
        }

        .breakers-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .table-header,
        .table-row {
          grid-template-columns: 1.5fr 1fr 1fr;
          font-size: 11px;
        }

        .table-header span:nth-child(2),
        .table-row .device-avg {
          display: none;
        }
      }
    `;
  }

  disconnectedCallback() {
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
    }
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }
  }
}

// ============================================================================
// VISUAL EDITOR CLASS
// ============================================================================
class HAPowercardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._activeTab = 'general';
    this._editingBreakerIndex = null;
    this._editingDeviceIndex = null;
  }

  setConfig(config) {
    this._config = {
      title: 'Distribution Board',
      animation_speed: 2,
      show_solar: true,
      show_grid: true,
      show_battery: false,
      accent_color: '#f59e0b',
      solar: { name: 'Solar' },
      grid: { name: 'Grid' },
      battery: { name: 'Battery' },
      main_breaker: { name: 'Main CB' },
      circuit_breakers: [],
      ...config
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Update entity pickers if they exist
    this.shadowRoot.querySelectorAll('ha-entity-picker').forEach(picker => {
      picker.hass = hass;
    });
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${this._getEditorStyles()}</style>
      <div class="editor-container">
        ${this._renderTabs()}
        ${this._renderTabContent()}
      </div>
    `;
    this._setupEditorListeners();
  }

  _renderTabs() {
    const tabs = [
      { id: 'general', label: 'General', icon: 'M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z' },
      { id: 'sources', label: 'Power Sources', icon: 'M11.5,20L16.36,10.27H13V4L8,13.73H11.5V20Z' },
      { id: 'main', label: 'Main Breaker', icon: 'M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z' },
      { id: 'breakers', label: 'Circuit Breakers', icon: 'M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z' }
    ];

    return `
      <div class="tabs">
        ${tabs.map(tab => `
          <button class="tab ${this._activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="${tab.icon}"/></svg>
            <span>${tab.label}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  _renderTabContent() {
    switch (this._activeTab) {
      case 'general': return this._renderGeneralTab();
      case 'sources': return this._renderSourcesTab();
      case 'main': return this._renderMainBreakerTab();
      case 'breakers': return this._renderBreakersTab();
      default: return '';
    }
  }

  _renderGeneralTab() {
    return `
      <div class="tab-content">
        <div class="form-group">
          <label>Card Title</label>
          <input type="text" class="form-input" data-field="title" value="${this._config.title || ''}" placeholder="Distribution Board">
        </div>

        <div class="form-group">
          <label>Accent Color</label>
          <div class="color-picker">
            <input type="color" data-field="accent_color" value="${this._config.accent_color || '#f59e0b'}">
            <input type="text" class="form-input" data-field="accent_color" value="${this._config.accent_color || '#f59e0b'}" placeholder="#f59e0b">
          </div>
        </div>

        <div class="form-group">
          <label>Animation Speed (seconds)</label>
          <input type="number" class="form-input" data-field="animation_speed" value="${this._config.animation_speed || 2}" min="0.5" max="10" step="0.5">
        </div>
      </div>
    `;
  }

  _renderSourcesTab() {
    return `
      <div class="tab-content">
        <!-- Solar -->
        <div class="section">
          <div class="section-header">
            <label class="toggle-label">
              <input type="checkbox" data-field="show_solar" ${this._config.show_solar ? 'checked' : ''}>
              <span class="toggle-switch"></span>
              <span>Enable Solar</span>
            </label>
          </div>
          ${this._config.show_solar ? `
            <div class="section-content">
              <div class="form-group">
                <label>Name</label>
                <input type="text" class="form-input" data-field="solar.name" value="${this._config.solar?.name || ''}" placeholder="Solar">
              </div>
              <div class="form-group">
                <label>Power Entity</label>
                <ha-entity-picker
                  .hass="${this._hass}"
                  .value="${this._config.solar?.entity || ''}"
                  data-field="solar.entity"
                  allow-custom-entity
                  include-domains='["sensor"]'
                ></ha-entity-picker>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Grid -->
        <div class="section">
          <div class="section-header">
            <label class="toggle-label">
              <input type="checkbox" data-field="show_grid" ${this._config.show_grid ? 'checked' : ''}>
              <span class="toggle-switch"></span>
              <span>Enable Grid</span>
            </label>
          </div>
          ${this._config.show_grid ? `
            <div class="section-content">
              <div class="form-group">
                <label>Name</label>
                <input type="text" class="form-input" data-field="grid.name" value="${this._config.grid?.name || ''}" placeholder="Grid">
              </div>
              <div class="form-group">
                <label>Power Entity</label>
                <ha-entity-picker
                  .hass="${this._hass}"
                  .value="${this._config.grid?.entity || ''}"
                  data-field="grid.entity"
                  allow-custom-entity
                  include-domains='["sensor"]'
                ></ha-entity-picker>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Battery -->
        <div class="section">
          <div class="section-header">
            <label class="toggle-label">
              <input type="checkbox" data-field="show_battery" ${this._config.show_battery ? 'checked' : ''}>
              <span class="toggle-switch"></span>
              <span>Enable Battery</span>
            </label>
          </div>
          ${this._config.show_battery ? `
            <div class="section-content">
              <div class="form-group">
                <label>Name</label>
                <input type="text" class="form-input" data-field="battery.name" value="${this._config.battery?.name || ''}" placeholder="Battery">
              </div>
              <div class="form-group">
                <label>Power Entity</label>
                <ha-entity-picker
                  .hass="${this._hass}"
                  .value="${this._config.battery?.entity || ''}"
                  data-field="battery.entity"
                  allow-custom-entity
                  include-domains='["sensor"]'
                ></ha-entity-picker>
              </div>
              <div class="form-group">
                <label>State of Charge Entity (%)</label>
                <ha-entity-picker
                  .hass="${this._hass}"
                  .value="${this._config.battery?.entity_soc || ''}"
                  data-field="battery.entity_soc"
                  allow-custom-entity
                  include-domains='["sensor"]'
                ></ha-entity-picker>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderMainBreakerTab() {
    const main = this._config.main_breaker || {};
    return `
      <div class="tab-content">
        <div class="form-group">
          <label>Name</label>
          <input type="text" class="form-input" data-field="main_breaker.name" value="${main.name || ''}" placeholder="Main CB">
        </div>
        <div class="form-group">
          <label>Power Entity (W)</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${main.entity_power || ''}"
            data-field="main_breaker.entity_power"
            allow-custom-entity
            include-domains='["sensor"]'
          ></ha-entity-picker>
        </div>
        <div class="form-group">
          <label>Energy Entity (kWh - Daily)</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${main.entity_energy || ''}"
            data-field="main_breaker.entity_energy"
            allow-custom-entity
            include-domains='["sensor"]'
          ></ha-entity-picker>
        </div>
        <div class="form-group">
          <label>Current Entity (A)</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${main.entity_current || ''}"
            data-field="main_breaker.entity_current"
            allow-custom-entity
            include-domains='["sensor"]'
          ></ha-entity-picker>
        </div>
      </div>
    `;
  }

  _renderBreakersTab() {
    const breakers = this._config.circuit_breakers || [];
    
    // If editing a breaker, show the breaker editor
    if (this._editingBreakerIndex !== null) {
      return this._renderBreakerEditor(breakers[this._editingBreakerIndex], this._editingBreakerIndex);
    }

    return `
      <div class="tab-content">
        <div class="breakers-list">
          ${breakers.map((cb, index) => `
            <div class="breaker-item">
              <div class="breaker-item-info">
                <span class="breaker-item-name">${cb.name || `CB-${index + 1}`}</span>
                <span class="breaker-item-meta">${cb.devices?.length || 0} devices</span>
              </div>
              <div class="breaker-item-actions">
                <button class="icon-btn" data-action="edit-breaker" data-index="${index}" title="Edit">
                  <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>
                </button>
                <button class="icon-btn danger" data-action="delete-breaker" data-index="${index}" title="Delete">
                  <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        
        <button class="add-btn" data-action="add-breaker">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
          Add Circuit Breaker
        </button>
      </div>
    `;
  }

  _renderBreakerEditor(breaker, index) {
    const cb = breaker || { name: '', devices: [] };
    
    // If editing a device, show device editor
    if (this._editingDeviceIndex !== null) {
      const device = cb.devices?.[this._editingDeviceIndex] || {};
      return this._renderDeviceEditor(device, this._editingDeviceIndex, index);
    }

    return `
      <div class="tab-content">
        <button class="back-btn" data-action="back-to-breakers">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/></svg>
          Back to Breakers
        </button>

        <h3 class="editor-subtitle">${cb.name || `Circuit Breaker ${index + 1}`}</h3>

        <div class="form-group">
          <label>Name</label>
          <input type="text" class="form-input" data-breaker-field="name" data-index="${index}" value="${cb.name || ''}" placeholder="CB-1 Kitchen">
        </div>
        <div class="form-group">
          <label>Power Entity (W)</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${cb.entity_power || ''}"
            data-breaker-field="entity_power"
            data-index="${index}"
            allow-custom-entity
            include-domains='["sensor"]'
          ></ha-entity-picker>
        </div>
        <div class="form-group">
          <label>Energy Entity (kWh - Daily)</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${cb.entity_energy || ''}"
            data-breaker-field="entity_energy"
            data-index="${index}"
            allow-custom-entity
            include-domains='["sensor"]'
          ></ha-entity-picker>
        </div>
        <div class="form-group">
          <label>Current Entity (A)</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${cb.entity_current || ''}"
            data-breaker-field="entity_current"
            data-index="${index}"
            allow-custom-entity
            include-domains='["sensor"]'
          ></ha-entity-picker>
        </div>

        <div class="section-divider"></div>

        <h4 class="devices-header-title">Connected Devices</h4>
        
        <div class="devices-list">
          ${(cb.devices || []).map((device, devIndex) => `
            <div class="device-item">
              <div class="device-item-info">
                ${device.icon ? `<ha-icon icon="${device.icon}"></ha-icon>` : '<ha-icon icon="mdi:power-plug"></ha-icon>'}
                <span>${device.name || `Device ${devIndex + 1}`}</span>
              </div>
              <div class="device-item-actions">
                <button class="icon-btn" data-action="edit-device" data-breaker="${index}" data-device="${devIndex}" title="Edit">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>
                </button>
                <button class="icon-btn danger" data-action="delete-device" data-breaker="${index}" data-device="${devIndex}" title="Delete">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <button class="add-btn secondary" data-action="add-device" data-breaker="${index}">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg>
          Add Device
        </button>
      </div>
    `;
  }

  _renderDeviceEditor(device, devIndex, breakerIndex) {
    const dev = device || {};
    const commonIcons = [
      'mdi:power-plug', 'mdi:lightning-bolt', 'mdi:fridge', 'mdi:stove', 'mdi:microwave',
      'mdi:dishwasher', 'mdi:washing-machine', 'mdi:tumble-dryer', 'mdi:television',
      'mdi:desktop-tower', 'mdi:laptop', 'mdi:lamp', 'mdi:ceiling-light', 'mdi:fan',
      'mdi:air-conditioner', 'mdi:water-heater', 'mdi:ev-station', 'mdi:car-electric',
      'mdi:speaker', 'mdi:printer', 'mdi:coffee-maker', 'mdi:toaster'
    ];

    return `
      <div class="tab-content">
        <button class="back-btn" data-action="back-to-breaker" data-breaker="${breakerIndex}">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/></svg>
          Back to Breaker
        </button>

        <h3 class="editor-subtitle">${dev.name || `Device ${devIndex + 1}`}</h3>

        <div class="form-group">
          <label>Device Name</label>
          <input type="text" class="form-input" data-device-field="name" data-breaker="${breakerIndex}" data-device="${devIndex}" value="${dev.name || ''}" placeholder="Refrigerator">
        </div>

        <div class="form-group">
          <label>Icon</label>
          <div class="icon-selector">
            <input type="text" class="form-input icon-input" data-device-field="icon" data-breaker="${breakerIndex}" data-device="${devIndex}" value="${dev.icon || ''}" placeholder="mdi:power-plug">
            <div class="icon-preview">
              <ha-icon icon="${dev.icon || 'mdi:power-plug'}"></ha-icon>
            </div>
          </div>
          <div class="icon-grid">
            ${commonIcons.map(icon => `
              <button class="icon-option ${dev.icon === icon ? 'selected' : ''}" data-select-icon="${icon}" data-breaker="${breakerIndex}" data-device="${devIndex}">
                <ha-icon icon="${icon}"></ha-icon>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="form-group">
          <label>Power Entity (W) - Current consumption</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${dev.entity || ''}"
            data-device-field="entity"
            data-breaker="${breakerIndex}"
            data-device="${devIndex}"
            allow-custom-entity
            include-domains='["sensor"]'
          ></ha-entity-picker>
        </div>

        <div class="form-group">
          <label>Average Hourly Entity (Wh)</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${dev.entity_avg || ''}"
            data-device-field="entity_avg"
            data-breaker="${breakerIndex}"
            data-device="${devIndex}"
            allow-custom-entity
            include-domains='["sensor"]'
          ></ha-entity-picker>
        </div>

        <div class="form-group">
          <label>Daily Energy Entity (kWh)</label>
          <ha-entity-picker
            .hass="${this._hass}"
            .value="${dev.entity_daily || ''}"
            data-device-field="entity_daily"
            data-breaker="${breakerIndex}"
            data-device="${devIndex}"
            allow-custom-entity
            include-domains='["sensor"]'
          ></ha-entity-picker>
        </div>
      </div>
    `;
  }

  _setupEditorListeners() {
    // Tab switching
    this.shadowRoot.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this._activeTab = tab.dataset.tab;
        this._editingBreakerIndex = null;
        this._editingDeviceIndex = null;
        this._render();
      });
    });

    // Text/number inputs
    this.shadowRoot.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        if (e.target.type === 'number') value = parseFloat(value);
        this._updateConfigField(field, value);
      });
    });

    // Color input sync
    this.shadowRoot.querySelectorAll('input[type="color"]').forEach(colorInput => {
      colorInput.addEventListener('input', (e) => {
        const field = e.target.dataset.field;
        const textInput = this.shadowRoot.querySelector(`input[type="text"][data-field="${field}"]`);
        if (textInput) textInput.value = e.target.value;
        this._updateConfigField(field, e.target.value);
      });
    });

    // Entity pickers
    this.shadowRoot.querySelectorAll('ha-entity-picker[data-field]').forEach(picker => {
      picker.addEventListener('value-changed', (e) => {
        this._updateConfigField(picker.dataset.field, e.detail.value);
      });
    });

    // Breaker field inputs
    this.shadowRoot.querySelectorAll('input[data-breaker-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const field = e.target.dataset.breakerField;
        this._updateBreakerField(index, field, e.target.value);
      });
    });

    // Breaker entity pickers
    this.shadowRoot.querySelectorAll('ha-entity-picker[data-breaker-field]').forEach(picker => {
      picker.addEventListener('value-changed', (e) => {
        const index = parseInt(picker.dataset.index);
        const field = picker.dataset.breakerField;
        this._updateBreakerField(index, field, e.detail.value);
      });
    });

    // Device field inputs
    this.shadowRoot.querySelectorAll('input[data-device-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const breakerIndex = parseInt(e.target.dataset.breaker);
        const deviceIndex = parseInt(e.target.dataset.device);
        const field = e.target.dataset.deviceField;
        this._updateDeviceField(breakerIndex, deviceIndex, field, e.target.value);
      });
    });

    // Device entity pickers
    this.shadowRoot.querySelectorAll('ha-entity-picker[data-device-field]').forEach(picker => {
      picker.addEventListener('value-changed', (e) => {
        const breakerIndex = parseInt(picker.dataset.breaker);
        const deviceIndex = parseInt(picker.dataset.device);
        const field = picker.dataset.deviceField;
        this._updateDeviceField(breakerIndex, deviceIndex, field, e.detail.value);
      });
    });

    // Icon selection
    this.shadowRoot.querySelectorAll('[data-select-icon]').forEach(btn => {
      btn.addEventListener('click', () => {
        const icon = btn.dataset.selectIcon;
        const breakerIndex = parseInt(btn.dataset.breaker);
        const deviceIndex = parseInt(btn.dataset.device);
        this._updateDeviceField(breakerIndex, deviceIndex, 'icon', icon);
        this._render();
      });
    });

    // Action buttons
    this.shadowRoot.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const index = btn.dataset.index !== undefined ? parseInt(btn.dataset.index) : null;
        const breakerIndex = btn.dataset.breaker !== undefined ? parseInt(btn.dataset.breaker) : null;
        const deviceIndex = btn.dataset.device !== undefined ? parseInt(btn.dataset.device) : null;

        switch (action) {
          case 'add-breaker':
            this._addBreaker();
            break;
          case 'edit-breaker':
            this._editingBreakerIndex = index;
            this._editingDeviceIndex = null;
            this._render();
            break;
          case 'delete-breaker':
            this._deleteBreaker(index);
            break;
          case 'back-to-breakers':
            this._editingBreakerIndex = null;
            this._editingDeviceIndex = null;
            this._render();
            break;
          case 'add-device':
            this._addDevice(breakerIndex);
            break;
          case 'edit-device':
            this._editingDeviceIndex = deviceIndex;
            this._render();
            break;
          case 'delete-device':
            this._deleteDevice(breakerIndex, deviceIndex);
            break;
          case 'back-to-breaker':
            this._editingDeviceIndex = null;
            this._render();
            break;
        }
      });
    });
  }

  _updateConfigField(field, value) {
    const parts = field.split('.');
    let obj = this._config;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    
    obj[parts[parts.length - 1]] = value;
    this._fireConfigChanged();
    
    // Re-render if toggling visibility
    if (field.startsWith('show_')) {
      this._render();
    }
  }

  _updateBreakerField(index, field, value) {
    if (!this._config.circuit_breakers) this._config.circuit_breakers = [];
    if (!this._config.circuit_breakers[index]) this._config.circuit_breakers[index] = {};
    this._config.circuit_breakers[index][field] = value;
    this._fireConfigChanged();
  }

  _updateDeviceField(breakerIndex, deviceIndex, field, value) {
    if (!this._config.circuit_breakers?.[breakerIndex]?.devices?.[deviceIndex]) return;
    this._config.circuit_breakers[breakerIndex].devices[deviceIndex][field] = value;
    this._fireConfigChanged();
  }

  _addBreaker() {
    if (!this._config.circuit_breakers) this._config.circuit_breakers = [];
    const newIndex = this._config.circuit_breakers.length;
    this._config.circuit_breakers.push({
      name: `CB-${newIndex + 1}`,
      entity_power: '',
      entity_energy: '',
      entity_current: '',
      devices: []
    });
    this._editingBreakerIndex = newIndex;
    this._fireConfigChanged();
    this._render();
  }

  _deleteBreaker(index) {
    if (!this._config.circuit_breakers) return;
    this._config.circuit_breakers.splice(index, 1);
    this._fireConfigChanged();
    this._render();
  }

  _addDevice(breakerIndex) {
    if (!this._config.circuit_breakers?.[breakerIndex]) return;
    if (!this._config.circuit_breakers[breakerIndex].devices) {
      this._config.circuit_breakers[breakerIndex].devices = [];
    }
    const newIndex = this._config.circuit_breakers[breakerIndex].devices.length;
    this._config.circuit_breakers[breakerIndex].devices.push({
      name: '',
      icon: 'mdi:power-plug',
      entity: '',
      entity_avg: '',
      entity_daily: ''
    });
    this._editingDeviceIndex = newIndex;
    this._fireConfigChanged();
    this._render();
  }

  _deleteDevice(breakerIndex, deviceIndex) {
    if (!this._config.circuit_breakers?.[breakerIndex]?.devices) return;
    this._config.circuit_breakers[breakerIndex].devices.splice(deviceIndex, 1);
    this._fireConfigChanged();
    this._render();
  }

  _fireConfigChanged() {
    const event = new CustomEvent('config-changed', {
      detail: { config: { ...this._config } },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }

  _getEditorStyles() {
    return `
      :host {
        --editor-bg: var(--card-background-color, #1e1e2e);
        --editor-surface: var(--primary-background-color, #181825);
        --editor-border: var(--divider-color, #313244);
        --editor-text: var(--primary-text-color, #cdd6f4);
        --editor-text-secondary: var(--secondary-text-color, #a6adc8);
        --editor-accent: var(--primary-color, #f59e0b);
        --editor-danger: #ef4444;
      }

      .editor-container {
        font-family: var(--paper-font-body1_-_font-family, 'Roboto', sans-serif);
      }

      .tabs {
        display: flex;
        gap: 4px;
        padding: 8px;
        background: var(--editor-surface);
        border-bottom: 1px solid var(--editor-border);
        overflow-x: auto;
      }

      .tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: var(--editor-text-secondary);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        transition: all 0.2s ease;
      }

      .tab:hover {
        background: var(--editor-border);
        color: var(--editor-text);
      }

      .tab.active {
        background: var(--editor-accent);
        color: #fff;
      }

      .tab svg {
        flex-shrink: 0;
      }

      .tab-content {
        padding: 16px;
      }

      .form-group {
        margin-bottom: 16px;
      }

      .form-group label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--editor-text-secondary);
        margin-bottom: 6px;
      }

      .form-input {
        width: 100%;
        padding: 10px 12px;
        background: var(--editor-surface);
        border: 1px solid var(--editor-border);
        border-radius: 8px;
        color: var(--editor-text);
        font-size: 14px;
        box-sizing: border-box;
      }

      .form-input:focus {
        outline: none;
        border-color: var(--editor-accent);
      }

      ha-entity-picker {
        display: block;
        width: 100%;
      }

      .color-picker {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .color-picker input[type="color"] {
        width: 48px;
        height: 40px;
        padding: 2px;
        border: 1px solid var(--editor-border);
        border-radius: 8px;
        cursor: pointer;
        background: var(--editor-surface);
      }

      .color-picker .form-input {
        flex: 1;
      }

      /* Toggle Switch */
      .toggle-label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: var(--editor-text);
      }

      .toggle-label input {
        display: none;
      }

      .toggle-switch {
        width: 40px;
        height: 22px;
        background: var(--editor-border);
        border-radius: 11px;
        position: relative;
        transition: background 0.2s ease;
      }

      .toggle-switch::after {
        content: '';
        position: absolute;
        width: 18px;
        height: 18px;
        background: #fff;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: transform 0.2s ease;
      }

      .toggle-label input:checked + .toggle-switch {
        background: var(--editor-accent);
      }

      .toggle-label input:checked + .toggle-switch::after {
        transform: translateX(18px);
      }

      /* Sections */
      .section {
        background: var(--editor-surface);
        border: 1px solid var(--editor-border);
        border-radius: 12px;
        margin-bottom: 12px;
        overflow: hidden;
      }

      .section-header {
        padding: 14px 16px;
        border-bottom: 1px solid transparent;
      }

      .section-content {
        padding: 16px;
        border-top: 1px solid var(--editor-border);
      }

      .section-divider {
        height: 1px;
        background: var(--editor-border);
        margin: 20px 0;
      }

      /* Lists */
      .breakers-list,
      .devices-list {
        margin-bottom: 12px;
      }

      .breaker-item,
      .device-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: var(--editor-surface);
        border: 1px solid var(--editor-border);
        border-radius: 10px;
        margin-bottom: 8px;
      }

      .breaker-item-info,
      .device-item-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .device-item-info ha-icon {
        --mdc-icon-size: 20px;
        color: var(--editor-text-secondary);
      }

      .breaker-item-name {
        font-weight: 600;
        color: var(--editor-text);
      }

      .breaker-item-meta {
        font-size: 12px;
        color: var(--editor-text-secondary);
      }

      .breaker-item-actions,
      .device-item-actions {
        display: flex;
        gap: 4px;
      }

      .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: var(--editor-text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .icon-btn:hover {
        background: var(--editor-border);
        color: var(--editor-text);
      }

      .icon-btn.danger:hover {
        background: rgba(239, 68, 68, 0.15);
        color: var(--editor-danger);
      }

      /* Buttons */
      .add-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px 16px;
        background: var(--editor-accent);
        border: none;
        border-radius: 10px;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .add-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .add-btn.secondary {
        background: var(--editor-surface);
        border: 1px dashed var(--editor-border);
        color: var(--editor-text-secondary);
      }

      .add-btn.secondary:hover {
        border-color: var(--editor-accent);
        color: var(--editor-accent);
      }

      .back-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: transparent;
        border: 1px solid var(--editor-border);
        border-radius: 8px;
        color: var(--editor-text-secondary);
        font-size: 13px;
        cursor: pointer;
        margin-bottom: 16px;
        transition: all 0.2s ease;
      }

      .back-btn:hover {
        border-color: var(--editor-accent);
        color: var(--editor-accent);
      }

      .editor-subtitle {
        margin: 0 0 16px;
        font-size: 16px;
        font-weight: 600;
        color: var(--editor-text);
      }

      .devices-header-title {
        margin: 0 0 12px;
        font-size: 14px;
        font-weight: 600;
        color: var(--editor-text-secondary);
      }

      /* Icon Grid */
      .icon-selector {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }

      .icon-input {
        flex: 1;
      }

      .icon-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        background: var(--editor-surface);
        border: 1px solid var(--editor-border);
        border-radius: 8px;
        color: var(--editor-text);
      }

      .icon-preview ha-icon {
        --mdc-icon-size: 24px;
      }

      .icon-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
        gap: 6px;
        max-height: 180px;
        overflow-y: auto;
        padding: 8px;
        background: var(--editor-surface);
        border-radius: 8px;
      }

      .icon-option {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: transparent;
        border: 1px solid var(--editor-border);
        border-radius: 8px;
        color: var(--editor-text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .icon-option:hover {
        border-color: var(--editor-accent);
        color: var(--editor-text);
      }

      .icon-option.selected {
        border-color: var(--editor-accent);
        background: rgba(245, 158, 11, 0.1);
        color: var(--editor-accent);
      }

      .icon-option ha-icon {
        --mdc-icon-size: 20px;
      }
    `;
  }
}

// ============================================================================
// REGISTER COMPONENTS
// ============================================================================
customElements.define('ha-powercard', HAPowercard);
customElements.define('ha-powercard-editor', HAPowercardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-powercard',
  name: 'HA Powercard',
  description: 'A distribution board style power flow visualization card with animated power flows',
  preview: true,
  documentationURL: 'https://github.com/rellis-erigon/HA-Powercard'
});
