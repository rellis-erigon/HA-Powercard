/**
 * HA-Powercard - Distribution Board Power Flow Card for Home Assistant
 * A novel visualization showing power distribution at the circuit breaker level
 * 
 * @version 1.0.0
 * @author rellis-erigon
 * @license MIT
 */

const CARD_VERSION = '1.0.0';

console.info(
  `%c HA-POWERCARD %c v${CARD_VERSION} `,
  'color: #fff; background: #f59e0b; font-weight: bold; padding: 2px 4px; border-radius: 4px 0 0 4px;',
  'color: #f59e0b; background: #1a1a2e; font-weight: bold; padding: 2px 4px; border-radius: 0 4px 4px 0;'
);

class HAPowercard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._expandedBreakers = new Set();
    this._animationFrame = null;
    this._particles = [];
  }

  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
    };
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
      solar: {},
      grid: {},
      main_breaker: {},
      circuit_breakers: [],
      theme: 'dark',
      ...config
    };

    this._render();
  }

  getCardSize() {
    return 6;
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
      solar: {
        entity: 'sensor.solar_power',
        name: 'Solar',
      },
      grid: {
        entity: 'sensor.grid_power',
        name: 'Grid',
      },
      main_breaker: {
        entity_power: 'sensor.main_power',
        entity_energy: 'sensor.main_energy_daily',
        entity_current: 'sensor.main_current',
        name: 'Main CB',
      },
      circuit_breakers: [
        {
          entity_power: 'sensor.circuit_1_power',
          entity_energy: 'sensor.circuit_1_energy_daily',
          entity_current: 'sensor.circuit_1_current',
          name: 'CB-1',
          devices: []
        }
      ]
    };
  }

  _getEntityState(entityId) {
    if (!this._hass || !entityId) return null;
    const state = this._hass.states[entityId];
    return state ? parseFloat(state.state) || 0 : 0;
  }

  _getEntityUnit(entityId) {
    if (!this._hass || !entityId) return '';
    const state = this._hass.states[entityId];
    return state?.attributes?.unit_of_measurement || '';
  }

  _formatValue(value, decimals = 1, unit = '') {
    if (value === null || value === undefined || isNaN(value)) return '---';
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
    this._startAnimation();
  }

  _updateCard() {
    if (!this.shadowRoot.querySelector('.powercard-container')) {
      this._render();
      return;
    }

    // Update solar data
    if (this._config.show_solar && this._config.solar?.entity) {
      const solarValue = this._getEntityState(this._config.solar.entity);
      const solarUnit = this._getEntityUnit(this._config.solar.entity);
      const solarEl = this.shadowRoot.querySelector('.solar-power-value');
      if (solarEl) solarEl.textContent = this._formatValue(solarValue, 0, solarUnit || 'W');
      
      // Update animation based on power
      this._updateFlowAnimation('solar', solarValue);
    }

    // Update grid data
    if (this._config.show_grid && this._config.grid?.entity) {
      const gridValue = this._getEntityState(this._config.grid.entity);
      const gridUnit = this._getEntityUnit(this._config.grid.entity);
      const gridEl = this.shadowRoot.querySelector('.grid-power-value');
      if (gridEl) gridEl.textContent = this._formatValue(gridValue, 0, gridUnit || 'W');
      
      this._updateFlowAnimation('grid', gridValue);
    }

    // Update main breaker
    this._updateBreakerData('main', this._config.main_breaker);

    // Update circuit breakers
    this._config.circuit_breakers?.forEach((cb, index) => {
      this._updateBreakerData(`cb-${index}`, cb);
    });
  }

  _updateBreakerData(id, config) {
    if (!config) return;

    const container = this.shadowRoot.querySelector(`[data-breaker="${id}"]`);
    if (!container) return;

    if (config.entity_energy) {
      const energy = this._getEntityState(config.entity_energy);
      const energyUnit = this._getEntityUnit(config.entity_energy) || 'kWh';
      const energyEl = container.querySelector('.breaker-energy');
      if (energyEl) energyEl.textContent = this._formatValue(energy, 2, energyUnit);
    }

    if (config.entity_current) {
      const current = this._getEntityState(config.entity_current);
      const currentEl = container.querySelector('.breaker-current');
      if (currentEl) currentEl.textContent = this._formatValue(current, 1, 'A');
    }

    if (config.entity_power) {
      const power = this._getEntityState(config.entity_power);
      const powerUnit = this._getEntityUnit(config.entity_power) || 'W';
      const powerEl = container.querySelector('.breaker-power');
      if (powerEl) powerEl.textContent = this._formatValue(power, 0, powerUnit);
    }
  }

  _updateFlowAnimation(type, power) {
    const flowLine = this.shadowRoot.querySelector(`.flow-line-${type}`);
    if (!flowLine) return;

    const isActive = power > 0;
    flowLine.classList.toggle('active', isActive);
    
    if (isActive) {
      const speed = Math.max(0.5, 4 - (power / 1000) * 2);
      flowLine.style.setProperty('--flow-speed', `${speed}s`);
    }
  }

  _startAnimation() {
    const canvas = this.shadowRoot.querySelector('.flow-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      this._animationFrame = requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      this._drawFlowLines(ctx, canvas);
      this._updateParticles(ctx);
    };

    animate();
  }

  _drawFlowLines(ctx, canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Calculate key positions
    const solarBoxRight = width * 0.35;
    const solarBoxBottom = height * 0.15;
    const gridBoxLeft = width * 0.85;
    const boardTop = height * 0.22;
    const busbarY = height * 0.28;
    const mainBreakerX = width * 0.12;

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 8;

    // Solar flow line
    if (this._config.show_solar) {
      const solarPower = this._getEntityState(this._config.solar?.entity) || 0;
      if (solarPower > 0) {
        ctx.beginPath();
        ctx.moveTo(solarBoxRight - 50, solarBoxBottom);
        ctx.lineTo(solarBoxRight - 50, busbarY);
        ctx.lineTo(mainBreakerX + 40, busbarY);
        ctx.stroke();
        
        this._addParticles('solar', [
          { x: solarBoxRight - 50, y: solarBoxBottom },
          { x: solarBoxRight - 50, y: busbarY },
          { x: mainBreakerX + 40, y: busbarY }
        ], solarPower);
      }
    }

    // Grid flow line
    if (this._config.show_grid) {
      const gridPower = this._getEntityState(this._config.grid?.entity) || 0;
      if (gridPower > 0) {
        ctx.beginPath();
        ctx.moveTo(gridBoxLeft, height * 0.12);
        ctx.lineTo(gridBoxLeft, busbarY);
        ctx.lineTo(width * 0.75, busbarY);
        ctx.stroke();
        
        this._addParticles('grid', [
          { x: gridBoxLeft, y: height * 0.12 },
          { x: gridBoxLeft, y: busbarY },
          { x: width * 0.75, y: busbarY }
        ], gridPower);
      }
    }

    // Main busbar
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(mainBreakerX, busbarY);
    ctx.lineTo(width * 0.88, busbarY);
    ctx.stroke();

    // Lines from busbar to each breaker
    const breakerCount = (this._config.circuit_breakers?.length || 0) + 1;
    const breakerSpacing = (width * 0.76) / breakerCount;
    
    ctx.lineWidth = 2;
    ctx.shadowBlur = 6;
    
    for (let i = 0; i < breakerCount; i++) {
      const x = mainBreakerX + 40 + (i * breakerSpacing);
      ctx.beginPath();
      ctx.moveTo(x, busbarY);
      ctx.lineTo(x, busbarY + 20);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }

  _addParticles(source, path, power) {
    if (power <= 0) return;
    
    const speed = Math.max(0.5, 3 - (power / 2000) * 2);
    const existing = this._particles.filter(p => p.source === source);
    
    if (existing.length < Math.min(10, Math.ceil(power / 200))) {
      if (Math.random() < 0.1) {
        this._particles.push({
          source,
          path,
          progress: 0,
          speed: speed * 0.02,
          size: 4 + Math.random() * 2
        });
      }
    }
  }

  _updateParticles(ctx) {
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;

    this._particles = this._particles.filter(particle => {
      particle.progress += particle.speed;
      
      if (particle.progress >= 1) return false;

      const pos = this._getPointOnPath(particle.path, particle.progress);
      
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      
      return true;
    });

    ctx.shadowBlur = 0;
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
    // Breaker click handlers for expansion
    this.shadowRoot.querySelectorAll('.breaker-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const breakerId = card.dataset.breaker;
        this._toggleBreakerExpansion(breakerId);
      });
    });

    // Entity click handlers for more-info dialog
    this.shadowRoot.querySelectorAll('[data-entity]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const entityId = el.dataset.entity;
        if (entityId && this._hass) {
          const event = new Event('hass-more-info', { bubbles: true, composed: true });
          event.detail = { entityId };
          this.dispatchEvent(event);
        }
      });
    });
  }

  _toggleBreakerExpansion(breakerId) {
    const devicesPanel = this.shadowRoot.querySelector(`[data-devices="${breakerId}"]`);
    if (!devicesPanel) return;

    if (this._expandedBreakers.has(breakerId)) {
      this._expandedBreakers.delete(breakerId);
      devicesPanel.classList.remove('expanded');
    } else {
      this._expandedBreakers.add(breakerId);
      devicesPanel.classList.add('expanded');
    }
  }

  _getHTML() {
    const config = this._config;
    
    return `
      <ha-card>
        <div class="powercard-container">
          <canvas class="flow-canvas"></canvas>
          
          <div class="power-sources">
            ${config.show_solar ? this._renderSolarBox() : ''}
            ${config.show_grid ? this._renderGridBox() : ''}
          </div>

          <div class="distribution-board">
            <div class="board-header">
              <span class="board-title">${config.title || 'Distribution Board'}</span>
            </div>
            
            <div class="busbar"></div>
            
            <div class="breakers-container">
              ${this._renderMainBreaker()}
              ${this._renderCircuitBreakers()}
              ${this._renderEmptySlots()}
            </div>
          </div>

          ${this._renderDevicesTables()}
        </div>
      </ha-card>
    `;
  }

  _renderSolarBox() {
    const config = this._config.solar || {};
    const power = this._getEntityState(config.entity);
    const unit = this._getEntityUnit(config.entity) || 'W';
    
    return `
      <div class="source-box solar-box" data-entity="${config.entity || ''}">
        <div class="source-icon">
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path fill="currentColor" d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/>
          </svg>
        </div>
        <div class="source-label">${config.name || 'Solar'}</div>
        <div class="source-value solar-power-value">${this._formatValue(power, 0, unit)}</div>
      </div>
    `;
  }

  _renderGridBox() {
    const config = this._config.grid || {};
    const power = this._getEntityState(config.entity);
    const unit = this._getEntityUnit(config.entity) || 'W';
    
    return `
      <div class="source-box grid-box" data-entity="${config.entity || ''}">
        <div class="source-icon">
          <svg viewBox="0 0 24 24" width="32" height="32">
            <path fill="currentColor" d="M8.28,5.45L6.5,4.55L7.76,2H16.24L17.5,4.55L15.72,5.45L15,4H9L8.28,5.45M18.62,8H14.09L13.3,5H10.7L9.91,8H5.38L4.1,10.55L5.89,11.44L6.62,10H17.38L18.1,11.44L19.89,10.55L18.62,8M17.77,22H15.7L15.46,21.21L12,14.82L8.54,21.21L8.3,22H6.23L9.12,15H5.38L4.1,12.55L5.89,11.64L6.62,13H17.38L18.1,11.64L19.89,12.55L18.62,15H14.88L17.77,22Z"/>
          </svg>
        </div>
        <div class="source-label">${config.name || 'Grid'}</div>
        <div class="source-value grid-power-value">${this._formatValue(power, 0, unit)}</div>
      </div>
    `;
  }

  _renderMainBreaker() {
    const config = this._config.main_breaker || {};
    const energy = this._getEntityState(config.entity_energy);
    const current = this._getEntityState(config.entity_current);
    const power = this._getEntityState(config.entity_power);
    
    return `
      <div class="breaker-card main-breaker" data-breaker="main">
        <div class="breaker-header">
          <span class="breaker-name">${config.name || 'Main CB'}</span>
          <div class="breaker-status ${power > 0 ? 'active' : ''}"></div>
        </div>
        <div class="breaker-data">
          <div class="data-row">
            <span class="data-label">Daily Total</span>
            <span class="data-value breaker-energy" data-entity="${config.entity_energy || ''}">${this._formatValue(energy, 2, 'kWh')}</span>
          </div>
          <div class="data-divider"></div>
          <div class="data-row">
            <span class="data-label">Live Data</span>
          </div>
          <div class="data-row">
            <span class="data-value breaker-current" data-entity="${config.entity_current || ''}">${this._formatValue(current, 1, 'A')}</span>
          </div>
          <div class="data-row">
            <span class="data-value breaker-power" data-entity="${config.entity_power || ''}">${this._formatValue(power, 0, 'W')}</span>
          </div>
        </div>
      </div>
    `;
  }

  _renderCircuitBreakers() {
    const breakers = this._config.circuit_breakers || [];
    
    return breakers.map((cb, index) => {
      const energy = this._getEntityState(cb.entity_energy);
      const current = this._getEntityState(cb.entity_current);
      const power = this._getEntityState(cb.entity_power);
      
      return `
        <div class="breaker-card" data-breaker="cb-${index}">
          <div class="breaker-header">
            <span class="breaker-name">${cb.name || `CB-${index + 1}`}</span>
            <div class="breaker-status ${power > 0 ? 'active' : ''}"></div>
          </div>
          <div class="breaker-data">
            <div class="data-row">
              <span class="data-label">Daily Total</span>
              <span class="data-value breaker-energy" data-entity="${cb.entity_energy || ''}">${this._formatValue(energy, 2, 'kWh')}</span>
            </div>
            <div class="data-divider"></div>
            <div class="data-row">
              <span class="data-label">Live Data</span>
            </div>
            <div class="data-row">
              <span class="data-value breaker-current" data-entity="${cb.entity_current || ''}">${this._formatValue(current, 1, 'A')}</span>
            </div>
            <div class="data-row">
              <span class="data-value breaker-power" data-entity="${cb.entity_power || ''}">${this._formatValue(power, 0, 'W')}</span>
            </div>
          </div>
          ${cb.devices?.length ? '<div class="expand-indicator">▼</div>' : ''}
        </div>
      `;
    }).join('');
  }

  _renderEmptySlots() {
    const existingBreakers = (this._config.circuit_breakers?.length || 0) + 1;
    const totalSlots = 8;
    const emptySlots = Math.max(0, totalSlots - existingBreakers);
    
    return Array(emptySlots).fill(0).map(() => `
      <div class="breaker-card empty-slot">
        <div class="empty-slot-inner"></div>
      </div>
    `).join('');
  }

  _renderDevicesTables() {
    const breakers = this._config.circuit_breakers || [];
    
    const tables = breakers.map((cb, index) => {
      if (!cb.devices?.length) return '';
      
      return `
        <div class="devices-panel" data-devices="cb-${index}">
          <div class="devices-header">
            <span class="devices-title">Devices linked to ${cb.name || `CB-${index + 1}`}</span>
            <span class="devices-subtitle">Average per/hour, Current usage and daily total per device</span>
          </div>
          <div class="devices-table">
            <div class="table-header">
              <span>Device</span>
              <span>Avg/Hour</span>
              <span>Current</span>
              <span>Daily Total</span>
            </div>
            ${cb.devices.map(device => `
              <div class="table-row" data-entity="${device.entity || ''}">
                <span class="device-name">
                  ${device.icon ? `<ha-icon icon="${device.icon}"></ha-icon>` : ''}
                  ${device.name || 'Device'}
                </span>
                <span class="device-avg">${this._formatValue(this._getEntityState(device.entity_avg), 1, 'Wh')}</span>
                <span class="device-current">${this._formatValue(this._getEntityState(device.entity), 0, 'W')}</span>
                <span class="device-daily">${this._formatValue(this._getEntityState(device.entity_daily), 2, 'kWh')}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).filter(Boolean).join('');

    return tables ? `<div class="devices-container">${tables}</div>` : '';
  }

  _getStyles() {
    const theme = this._config.theme === 'light' ? 'light' : 'dark';
    
    return `
      :host {
        --powercard-bg: ${theme === 'dark' ? '#1a1a2e' : '#ffffff'};
        --powercard-surface: ${theme === 'dark' ? '#16213e' : '#f8f9fa'};
        --powercard-border: ${theme === 'dark' ? '#0f3460' : '#dee2e6'};
        --powercard-text: ${theme === 'dark' ? '#e4e4e7' : '#212529'};
        --powercard-text-muted: ${theme === 'dark' ? '#94a3b8' : '#6c757d'};
        --powercard-accent: #f59e0b;
        --powercard-accent-glow: rgba(245, 158, 11, 0.4);
        --powercard-solar: #fbbf24;
        --powercard-grid: #6b7280;
        --powercard-success: #22c55e;
        --flow-speed: 2s;
      }

      ha-card {
        background: var(--powercard-bg);
        border-radius: 16px;
        overflow: hidden;
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      }

      .powercard-container {
        position: relative;
        padding: 20px;
        min-height: 400px;
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

      /* Power Sources */
      .power-sources {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
        position: relative;
        z-index: 2;
      }

      .source-box {
        background: var(--powercard-surface);
        border: 2px solid var(--powercard-border);
        border-radius: 12px;
        padding: 16px 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s ease;
        min-width: 140px;
      }

      .source-box:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      }

      .solar-box {
        border-color: var(--powercard-solar);
        box-shadow: 0 0 20px rgba(251, 191, 36, 0.2);
      }

      .solar-box .source-icon {
        color: var(--powercard-solar);
      }

      .grid-box {
        border-color: var(--powercard-grid);
      }

      .grid-box .source-icon {
        color: var(--powercard-grid);
      }

      .source-icon {
        margin-bottom: 8px;
      }

      .source-label {
        font-size: 14px;
        color: var(--powercard-text-muted);
        margin-bottom: 4px;
      }

      .source-value {
        font-size: 20px;
        font-weight: 600;
        color: var(--powercard-text);
      }

      /* Distribution Board */
      .distribution-board {
        background: var(--powercard-surface);
        border: 3px solid var(--powercard-border);
        border-radius: 12px;
        padding: 16px;
        position: relative;
        z-index: 2;
      }

      .board-header {
        text-align: center;
        margin-bottom: 16px;
      }

      .board-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--powercard-text);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .busbar {
        height: 6px;
        background: linear-gradient(90deg, 
          var(--powercard-accent) 0%, 
          var(--powercard-accent) 100%
        );
        border-radius: 3px;
        margin-bottom: 20px;
        box-shadow: 0 0 15px var(--powercard-accent-glow);
        animation: busbar-glow 2s ease-in-out infinite;
      }

      @keyframes busbar-glow {
        0%, 100% { box-shadow: 0 0 10px var(--powercard-accent-glow); }
        50% { box-shadow: 0 0 25px var(--powercard-accent-glow), 0 0 40px var(--powercard-accent-glow); }
      }

      .breakers-container {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        justify-content: flex-start;
      }

      /* Breaker Cards */
      .breaker-card {
        background: var(--powercard-bg);
        border: 2px solid var(--powercard-border);
        border-radius: 8px;
        padding: 12px;
        min-width: 100px;
        flex: 1;
        max-width: 130px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
      }

      .breaker-card:hover {
        border-color: var(--powercard-accent);
        transform: translateY(-2px);
      }

      .breaker-card.main-breaker {
        border-color: var(--powercard-accent);
        box-shadow: 0 0 15px var(--powercard-accent-glow);
      }

      .breaker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--powercard-border);
      }

      .breaker-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--powercard-accent);
      }

      .breaker-status {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--powercard-grid);
        transition: all 0.3s ease;
      }

      .breaker-status.active {
        background: var(--powercard-success);
        box-shadow: 0 0 8px var(--powercard-success);
      }

      .breaker-data {
        font-size: 11px;
      }

      .data-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }

      .data-label {
        color: var(--powercard-text-muted);
        font-size: 10px;
      }

      .data-value {
        color: var(--powercard-text);
        font-weight: 500;
        font-size: 12px;
      }

      .data-value[data-entity]:hover {
        color: var(--powercard-accent);
      }

      .data-divider {
        height: 1px;
        background: var(--powercard-border);
        margin: 8px 0;
      }

      .expand-indicator {
        text-align: center;
        color: var(--powercard-text-muted);
        font-size: 10px;
        margin-top: 8px;
      }

      /* Empty Slots */
      .empty-slot {
        border-style: dashed;
        opacity: 0.4;
        cursor: default;
      }

      .empty-slot:hover {
        transform: none;
        border-color: var(--powercard-border);
      }

      .empty-slot-inner {
        height: 80px;
      }

      /* Devices Panel */
      .devices-container {
        margin-top: 20px;
        position: relative;
        z-index: 2;
      }

      .devices-panel {
        background: var(--powercard-surface);
        border: 2px solid var(--powercard-border);
        border-radius: 12px;
        padding: 16px;
        margin-top: 12px;
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        transition: all 0.3s ease;
      }

      .devices-panel.expanded {
        max-height: 500px;
        opacity: 1;
      }

      .devices-header {
        margin-bottom: 16px;
      }

      .devices-title {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: var(--powercard-accent);
        margin-bottom: 4px;
      }

      .devices-subtitle {
        font-size: 11px;
        color: var(--powercard-text-muted);
      }

      .devices-table {
        font-size: 12px;
      }

      .table-header {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr;
        gap: 8px;
        padding: 8px 12px;
        background: var(--powercard-bg);
        border-radius: 6px;
        margin-bottom: 8px;
        font-weight: 600;
        color: var(--powercard-text-muted);
        font-size: 11px;
      }

      .table-row {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 6px;
        transition: background 0.2s ease;
        cursor: pointer;
      }

      .table-row:hover {
        background: var(--powercard-bg);
      }

      .device-name {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--powercard-text);
      }

      .device-name ha-icon {
        --mdc-icon-size: 16px;
        color: var(--powercard-text-muted);
      }

      .device-avg,
      .device-current,
      .device-daily {
        color: var(--powercard-text);
        text-align: right;
      }

      /* Flow Animation */
      .flow-line {
        stroke-dasharray: 8 4;
        stroke-dashoffset: 0;
      }

      .flow-line.active {
        animation: flow var(--flow-speed) linear infinite;
      }

      @keyframes flow {
        from { stroke-dashoffset: 24; }
        to { stroke-dashoffset: 0; }
      }

      /* Responsive */
      @media (max-width: 600px) {
        .powercard-container {
          padding: 12px;
        }

        .source-box {
          min-width: 100px;
          padding: 12px 16px;
        }

        .breaker-card {
          min-width: 80px;
          max-width: none;
          flex: 1 1 calc(33% - 8px);
        }

        .table-header,
        .table-row {
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          font-size: 10px;
        }
      }
    `;
  }

  disconnectedCallback() {
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
    }
  }
}

// Register the card
customElements.define('ha-powercard', HAPowercard);

// Card Editor
class HAPowercardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        .editor-container {
          padding: 16px;
        }
        .editor-section {
          margin-bottom: 24px;
        }
        .editor-section-title {
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--primary-text-color);
        }
        .editor-row {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }
        .editor-field {
          flex: 1;
        }
        ha-textfield {
          width: 100%;
        }
      </style>
      <div class="editor-container">
        <div class="editor-section">
          <div class="editor-section-title">General</div>
          <div class="editor-row">
            <div class="editor-field">
              <ha-textfield
                label="Title"
                .value="${this._config.title || ''}"
                @input="${e => this._updateConfig('title', e.target.value)}"
              ></ha-textfield>
            </div>
          </div>
        </div>

        <div class="editor-section">
          <div class="editor-section-title">Solar Configuration</div>
          <div class="editor-row">
            <div class="editor-field">
              <ha-entity-picker
                label="Solar Power Entity"
                .hass="${this._hass}"
                .value="${this._config.solar?.entity || ''}"
                @value-changed="${e => this._updateNestedConfig('solar', 'entity', e.detail.value)}"
                allow-custom-entity
              ></ha-entity-picker>
            </div>
          </div>
        </div>

        <div class="editor-section">
          <div class="editor-section-title">Grid Configuration</div>
          <div class="editor-row">
            <div class="editor-field">
              <ha-entity-picker
                label="Grid Power Entity"
                .hass="${this._hass}"
                .value="${this._config.grid?.entity || ''}"
                @value-changed="${e => this._updateNestedConfig('grid', 'entity', e.detail.value)}"
                allow-custom-entity
              ></ha-entity-picker>
            </div>
          </div>
        </div>

        <div class="editor-section">
          <div class="editor-section-title">Main Breaker</div>
          <div class="editor-row">
            <div class="editor-field">
              <ha-entity-picker
                label="Power Entity"
                .hass="${this._hass}"
                .value="${this._config.main_breaker?.entity_power || ''}"
                @value-changed="${e => this._updateNestedConfig('main_breaker', 'entity_power', e.detail.value)}"
                allow-custom-entity
              ></ha-entity-picker>
            </div>
          </div>
          <div class="editor-row">
            <div class="editor-field">
              <ha-entity-picker
                label="Energy Entity (Daily)"
                .hass="${this._hass}"
                .value="${this._config.main_breaker?.entity_energy || ''}"
                @value-changed="${e => this._updateNestedConfig('main_breaker', 'entity_energy', e.detail.value)}"
                allow-custom-entity
              ></ha-entity-picker>
            </div>
          </div>
          <div class="editor-row">
            <div class="editor-field">
              <ha-entity-picker
                label="Current Entity"
                .hass="${this._hass}"
                .value="${this._config.main_breaker?.entity_current || ''}"
                @value-changed="${e => this._updateNestedConfig('main_breaker', 'entity_current', e.detail.value)}"
                allow-custom-entity
              ></ha-entity-picker>
            </div>
          </div>
        </div>

        <p style="color: var(--secondary-text-color); font-size: 12px;">
          Configure circuit breakers and devices in YAML mode for full control.
        </p>
      </div>
    `;
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    this._fireConfigChanged();
  }

  _updateNestedConfig(parent, key, value) {
    this._config = {
      ...this._config,
      [parent]: {
        ...this._config[parent],
        [key]: value
      }
    };
    this._fireConfigChanged();
  }

  _fireConfigChanged() {
    const event = new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }
}

customElements.define('ha-powercard-editor', HAPowercardEditor);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'ha-powercard',
  name: 'HA Powercard',
  description: 'A distribution board style power flow visualization card with animated power flows',
  preview: true,
  documentationURL: 'https://github.com/rellis-erigon/HA-Powercard'
});
