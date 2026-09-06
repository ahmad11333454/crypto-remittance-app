/* ===== UI MANAGEMENT ===== */

// Setup navigation between views
function setupNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewName = btn.dataset.view;

      // Update active button
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update active panel
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      $(`view-${viewName}`).classList.add('active');

      // Load data for the view
      if (viewName === 'remittance') {
        updateFeeDisplay();
      } else if (viewName === 'history') {
        loadRemittanceHistory();
      } else if (viewName === 'tokens') {
        loadTokenList();
      } else if (viewName === 'broker') {
        loadBrokerList();
        populateBrokerSelect();
      }

      logDebug('Switched to view:', viewName);
    });
  });

  // Set remittance as default active view
  const defaultBtn = document.querySelector('[data-view="remittance"]');
  if (defaultBtn) {
    defaultBtn.click();
  }
}

// Setup connect button
function setupConnectButton() {
  $('connectBtn').addEventListener('click', () => {
    $('connectView').classList.toggle('hidden');
    if (!$('connectView').classList.contains('hidden')) {
      $('connectView').scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// Update balance display
function updateBalanceDisplay() {
  setInterval(async () => {
    if (account && !isReadOnly) {
      try {
        await refreshNativeBalance();
      } catch (e) {
        logError('Balance update error:', e);
      }
    }
  }, 30000); // Update every 30 seconds
}

// Format currency display
function formatCurrency(amount, symbol = 'BNB') {
  return `${formatNumber(amount)} ${symbol}`;
}

// Show toast notification
function showToast(message, type = 'info', duration = CONFIG.UI.notificationDuration) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 16px 20px;
    background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--info)'};
    color: white;
    border-radius: var(--radius-md);
    font-size: 14px;
    z-index: 2000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Copy to clipboard utility
function copyToClipboard(text, message = 'تم النسخ!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(message, 'success', 2000);
  }).catch(err => {
    logError('Copy error:', err);
    showToast('فشل النسخ', 'error');
  });
}

// Debounce function for input events
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Add debounce to amount input
const debouncedFeeUpdate = debounce(() => {
  updateFeeDisplay();
}, CONFIG.UI.debounceDelay);

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + C: Copy account address
    if ((e.ctrlKey || e.metaKey) && e.key === 'c' && e.target === document.body) {
      if (account) {
        copyToClipboard(account, 'تم نسخ العنوان');
      }
    }

    // Ctrl/Cmd + S: Focus on send amount field
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      $('remitAmount').focus();
    }

    // Escape: Close modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(m => {
        m.classList.remove('active');
      });
    }
  });
}

// Setup dark mode toggle (optional)
function setupThemeToggle() {
  const themeToggle = document.createElement('button');
  themeToggle.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: var(--primary);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 999;
    transition: var(--transition);
  `;
  themeToggle.textContent = '🌙';
  themeToggle.title = 'Toggle theme';

  themeToggle.addEventListener('click', () => {
    document.documentElement.style.filter = 
      document.documentElement.style.filter === 'invert(1)' 
        ? 'none' 
        : 'invert(1)';
    themeToggle.textContent = document.documentElement.style.filter === 'invert(1)' ? '☀️' : '🌙';
  });

  // Only show if not in mobile
  if (window.innerWidth > 768) {
    document.body.appendChild(themeToggle);
  }
}

// Add animations CSS
function addAnimationsCSS() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .fade-in {
      animation: fadeIn 0.3s ease;
    }

    .spin {
      animation: spin 1s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

// Setup form validation
function setupFormValidation() {
  $('remitAmount').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    
    if (value && (value < CONFIG.REMITTANCE.minAmount || value > CONFIG.REMITTANCE.maxAmount)) {
      e.target.style.borderColor = 'var(--danger)';
    } else {
      e.target.style.borderColor = '';
    }

    debouncedFeeUpdate();
  });

  $('brokerFeeRate').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    
    if (value && (value < CONFIG.BROKER.minCommissionRate || value > CONFIG.BROKER.maxCommissionRate)) {
      e.target.style.borderColor = 'var(--danger)';
    } else {
      e.target.style.borderColor = '';
    }
  });

  $('brokerAddr').addEventListener('input', (e) => {
    const value = e.target.value.trim();
    
    if (value && !isValidAddress(value)) {
      e.target.style.borderColor = 'var(--danger)';
    } else {
      e.target.style.borderColor = '';
    }
  });

  $('remitRecipient').addEventListener('input', (e) => {
    const value = e.target.value.trim();
    const remitType = document.querySelector('input[name="remitType"]:checked')?.value;
    
    if (remitType === REMITTANCE_TYPES.DIRECT_WALLET && value && !isValidAddress(value)) {
      e.target.style.borderColor = 'var(--danger)';
    } else {
      e.target.style.borderColor = '';
    }
  });
}

// Setup responsive behavior
function setupResponsive() {
  const handleResize = debounce(() => {
    const width = window.innerWidth;

    // Hide sidebar on mobile
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      if (width < 768) {
        sidebar.style.display = 'none';
      } else {
        sidebar.style.display = 'flex';
      }
    }

    logDebug('Window resized to:', width);
  }, 250);

  window.addEventListener('resize', handleResize);
  handleResize(); // Initial call
}

// Setup progress indicator for transactions
function showTransactionProgress(txHash) {
  const progress = document.createElement('div');
  progress.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--primary), var(--primary-light));
    animation: slideIn 0.3s ease;
    z-index: 2001;
  `;
  document.body.appendChild(progress);

  setTimeout(() => {
    progress.style.width = '90%';
    progress.style.transition = 'width 20s linear';
  }, 100);

  // Remove after transaction completes or 5 minutes
  setTimeout(() => {
    progress.style.opacity = '0';
    progress.style.transition = 'opacity 0.3s ease';
    setTimeout(() => progress.remove(), 300);
  }, 300000);
}

// Setup info tooltips
function setupTooltips() {
  document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.addEventListener('mouseenter', () => {
      const tooltip = document.createElement('div');
      tooltip.style.cssText = `
        position: absolute;
        background: var(--bg-primary);
        color: var(--text-primary);
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        font-size: 12px;
        z-index: 1000;
        border: 1px solid var(--border);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        white-space: nowrap;
      `;
      tooltip.textContent = el.dataset.tooltip;
      
      const rect = el.getBoundingClientRect();
      tooltip.style.top = (rect.top - 30) + 'px';
      tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
      
      document.body.appendChild(tooltip);

      el.addEventListener('mouseleave', () => {
        tooltip.remove();
      });
    });
  });
}

// Setup auto-refresh
function setupAutoRefresh() {
  // Refresh balances every 60 seconds
  setInterval(() => {
    if (account && !isReadOnly) {
      refreshNativeBalance().catch(e => logError('Auto-refresh error:', e));
      loadTokenList().catch(e => logError('Token list refresh error:', e));
    }
  }, 60000);

  logDebug('Auto-refresh enabled');
}

// Setup page visibility detection
function setupVisibilityDetection() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      logDebug('Page hidden');
    } else {
      logDebug('Page visible');
      if (account && !isReadOnly) {
        refreshNativeBalance().catch(e => logError('Visibility refresh error:', e));
      }
    }
  });
}

// Setup error handling
function setupErrorHandling() {
  window.addEventListener('error', (event) => {
    logError('Uncaught error:', event.error);
    showToast('حدث خطأ: ' + (event.error?.message || 'خطأ غير معروف'), 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError('Unhandled promise rejection:', event.reason);
    showToast('خطأ: ' + (event.reason?.message || 'خطأ غير معروف'), 'error');
  });
}

// Initialize UI
function initUI() {
  // Add CSS animations
  addAnimationsCSS();

  // Setup all event listeners and features
  setupNavigation();
  setupConnectButton();
  setupKeyboardShortcuts();
  setupFormValidation();
  setupResponsive();
  setupAutoRefresh();
  setupVisibilityDetection();
  setupErrorHandling();

  // Optional theme toggle (only on desktop)
  if (window.innerWidth > 768) {
    setupThemeToggle();
  }

  // Update balance periodically
  updateBalanceDisplay();

  logDebug('UI initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  // Save any unsaved data
  saveRemittances();
  saveBrokers();
  logDebug('Page unloading - data saved');
});
