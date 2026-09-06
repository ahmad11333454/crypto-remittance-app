/* ===== BROKER MANAGEMENT ===== */

// Store brokers locally
let brokers = JSON.parse(localStorage.getItem(CONFIG.BROKER.storageKey)) || [];

// Add a new broker
async function addBroker() {
  const name = $('brokerName').value.trim();
  const brokerAddr = $('brokerAddr').value.trim();
  const feeRate = parseFloat($('brokerFeeRate').value);
  const phone = $('brokerPhone').value.trim();
  const statusEl = $('brokerStatus');

  // Validation
  if (!name) {
    showStatus(statusEl, 'err', 'الرجاء إدخال اسم الوسيط');
    return;
  }

  if (!isValidAddress(brokerAddr)) {
    showStatus(statusEl, 'err', 'عنوان المحفظة غير صالح');
    return;
  }

  if (!feeRate || feeRate < CONFIG.BROKER.minCommissionRate || feeRate > CONFIG.BROKER.maxCommissionRate) {
    showStatus(statusEl, 'err', `نسبة العمولة يجب أن تكون بين ${CONFIG.BROKER.minCommissionRate}% و ${CONFIG.BROKER.maxCommissionRate}%`);
    return;
  }

  if (!isValidPhone(phone)) {
    showStatus(statusEl, 'err', 'رقم هاتف غير صالح');
    return;
  }

  // Check if broker already exists
  if (brokers.some(b => b.address.toLowerCase() === brokerAddr.toLowerCase())) {
    showStatus(statusEl, 'err', 'هذا الوسيط مسجل بالفعل');
    return;
  }

  try {
    // Verify broker address is valid on blockchain
    const code = await provider.getCode(brokerAddr);
    // Address can be EOA or contract, just verify it exists

    const broker = {
      id: generateId(),
      name,
      address: ethers.utils.getAddress(brokerAddr),
      feeRate,
      phone,
      website: '',
      description: '',
      rating: 5,
      totalTransactions: 0,
      createdAt: getCurrentTimestamp(),
      verified: false,
      status: 'active'
    };

    brokers.unshift(broker);
    saveBrokers();

    showStatus(statusEl, 'ok', `تم تسجيل الوسيط "${name}" بنجاح`);

    // Clear form
    $('brokerName').value = '';
    $('brokerAddr').value = '';
    $('brokerFeeRate').value = '';
    $('brokerPhone').value = '';

    setTimeout(() => {
      $('brokerStatus').innerHTML = '';
      loadBrokerList();
      populateBrokerSelect();
    }, 1500);

  } catch (err) {
    showStatus(statusEl, 'err', 'خطأ: ' + (err.message || err));
    logError('Add broker error:', err);
  }
}

// Load and display broker list
function loadBrokerList() {
  const listEl = $('brokerList');

  if (brokers.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:16px;">لا توجد وسطاء مسجلين</div>';
    return;
  }

  listEl.innerHTML = '';

  brokers.forEach(broker => {
    const item = document.createElement('div');
    item.className = 'broker-item';

    item.innerHTML = `
      <div class="broker-info">
        <div class="broker-name">
          ${broker.name}
          ${broker.verified ? '<span style="color:var(--success);font-size:12px;margin-right:8px;">✓ موثق</span>' : ''}
        </div>
        <div class="broker-detail">
          📍 ${shortAddress(broker.address)}
        </div>
        <div class="broker-detail">
          📱 ${broker.phone}
        </div>
        <div class="broker-detail">
          ⭐ ${broker.rating}/5 (${broker.totalTransactions} معاملة)
        </div>
      </div>
      <div class="broker-fee">
        <div class="broker-fee-rate">العمولة</div>
        <div class="broker-fee-value">${broker.feeRate}%</div>
        <button class="btn-info" onclick="deleteBroker('${broker.id}')" style="margin-top:8px;width:100%;">حذف</button>
      </div>
    `;

    listEl.appendChild(item);
  });
}

// Populate broker select dropdown
function populateBrokerSelect() {
  const sel = $('brokerSelect');
  sel.innerHTML = '<option value="">-- اختر وسيط --</option>';

  brokers.forEach(broker => {
    const opt = document.createElement('option');
    opt.value = broker.address;
    opt.textContent = `${broker.name} (${broker.feeRate}%)`;
    sel.appendChild(opt);
  });
}

// Delete broker
function deleteBroker(brokerId) {
  if (!confirm('هل أنت متأكد من حذف هذا الوسيط؟')) {
    return;
  }

  brokers = brokers.filter(b => b.id !== brokerId);
  saveBrokers();
  loadBrokerList();
  populateBrokerSelect();

  showStatus($('brokerStatus'), 'ok', 'تم حذف الوسيط بنجاح');
  setTimeout(() => {
    $('brokerStatus').innerHTML = '';
  }, 2000);
}

// Get broker info
function getBrokerInfo(brokerAddr) {
  return brokers.find(b => b.address.toLowerCase() === brokerAddr.toLowerCase());
}

// Update broker rating
function updateBrokerRating(brokerAddr, newRating) {
  const broker = getBrokerInfo(brokerAddr);
  if (broker) {
    // Simple averaging
    broker.rating = (broker.rating + newRating) / 2;
    broker.totalTransactions += 1;
    saveBrokers();
  }
}

// Verify broker (admin function)
async function verifyBroker(brokerAddr) {
  const broker = getBrokerInfo(brokerAddr);
  if (broker) {
    broker.verified = true;
    saveBrokers();
    loadBrokerList();
  }
}

// Get broker commission amount
function getBrokerCommission(brokerAddr, amount) {
  const broker = getBrokerInfo(brokerAddr);
  if (!broker) return 0;
  
  const commission = calculateFee(amount, broker.feeRate);
  return Math.max(commission, CONFIG.BROKER.minCommissionAmount);
}

// Show broker information modal
function showBrokerInfo() {
  const brokerAddr = $('brokerSelect').value;
  if (!brokerAddr) {
    alert('الرجاء اختيار وسيط أولاً');
    return;
  }

  const broker = getBrokerInfo(brokerAddr);
  if (!broker) {
    alert('لم يتم العثور على بيانات الوسيط');
    return;
  }

  const infoHtml = `
    <div style="background:var(--bg-tertiary);border-radius:var(--radius-lg);padding:16px;">
      <h3 style="margin-bottom:12px;">${broker.name}</h3>
      
      <div style="display:grid;gap:8px;font-size:13px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;border-bottom:1px solid var(--border);padding-bottom:12px;">
          <div>
            <span style="color:var(--text-dim);">العنوان:</span><br>
            <span style="font-family:'Courier New',monospace;font-size:11px;color:var(--primary-light);">${broker.address}</span>
          </div>
          <div>
            <span style="color:var(--text-dim);">العمولة:</span><br>
            <span style="font-weight:600;color:var(--primary-light);font-size:14px;">${broker.feeRate}%</span>
          </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <span style="color:var(--text-dim);">التقييم:</span><br>
            <span style="font-weight:600;">⭐ ${broker.rating.toFixed(1)}/5</span>
          </div>
          <div>
            <span style="color:var(--text-dim);">المعاملات:</span><br>
            <span style="font-weight:600;">${broker.totalTransactions}</span>
          </div>
        </div>
        
        <div>
          <span style="color:var(--text-dim);">الهاتف:</span><br>
          <span style="font-weight:600;">${broker.phone}</span>
        </div>
        
        <div>
          <span style="color:var(--text-dim);">الحالة:</span><br>
          <span style="display:inline-block;padding:4px 8px;background:${broker.verified ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'};color:${broker.verified ? 'var(--success)' : 'var(--warning)'};border-radius:var(--radius-sm);font-size:11px;font-weight:600;">
            ${broker.verified ? '✓ موثق' : '⚠️ غير موثق'}
          </span>
        </div>
      </div>
    </div>
  `;

  alert(`معلومات الوسيط:\n\n${broker.name}\nالعمولة: ${broker.feeRate}%\nالهاتف: ${broker.phone}\nالتقييم: ${broker.rating.toFixed(1)}/5`);
}

// Save brokers to localStorage
function saveBrokers() {
  localStorage.setItem(CONFIG.BROKER.storageKey, JSON.stringify(brokers));
}

// Load brokers from localStorage
function loadBrokers() {
  return JSON.parse(localStorage.getItem(CONFIG.BROKER.storageKey)) || [];
}

// Check if a broker is verified
function isBrokerVerified(brokerAddr) {
  const broker = getBrokerInfo(brokerAddr);
  return broker ? broker.verified : false;
}

// Get top brokers (by rating and transactions)
function getTopBrokers(limit = 5) {
  return brokers
    .sort((a, b) => {
      // Sort by rating descending, then by transactions
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.totalTransactions - a.totalTransactions;
    })
    .slice(0, limit);
}

// Search brokers
function searchBrokers(query) {
  const q = query.toLowerCase();
  return brokers.filter(b => 
    b.name.toLowerCase().includes(q) ||
    b.phone.toLowerCase().includes(q) ||
    b.address.toLowerCase().includes(q)
  );
}

// Get broker statistics
function getBrokerStats() {
  const stats = {
    totalBrokers: brokers.length,
    verifiedBrokers: brokers.filter(b => b.verified).length,
    averageRating: brokers.length > 0 ? brokers.reduce((sum, b) => sum + b.rating, 0) / brokers.length : 0,
    totalTransactions: brokers.reduce((sum, b) => sum + b.totalTransactions, 0),
    activeStatus: brokers.filter(b => b.status === 'active').length
  };
  return stats;
}

// Export broker as QR code (for sharing)
function exportBrokerQR(brokerAddr) {
  const broker = getBrokerInfo(brokerAddr);
  if (!broker) return;

  const qrData = JSON.stringify({
    type: 'broker',
    name: broker.name,
    address: broker.address,
    phone: broker.phone,
    feeRate: broker.feeRate
  });

  // Create QR modal and show it
  const modal = document.createElement('div');
  modal.className = 'modal active';
  modal.id = 'brokerQRModal';
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" onclick="document.getElementById('brokerQRModal').remove();">&times;</button>
      <h2>مشاركة بيانات الوسيط</h2>
      <div id="brokerQR" style="background:white;border-radius:var(--radius-md);padding:16px;margin:16px 0;display:flex;justify-content:center;"></div>
      <p style="font-size:12px;color:var(--text-dim);text-align:center;">امسح هذا الكود لإضافة الوسيط</p>
    </div>
  `;

  document.body.appendChild(modal);

  try {
    new QRCode(document.getElementById('brokerQR'), {
      text: qrData,
      width: 200,
      height: 200
    });
  } catch (e) {
    logError('QR generation error:', e);
  }
}

// Setup broker event listeners
function setupBrokerEventListeners() {
  $('addBrokerBtn').addEventListener('click', addBroker);
  $('brokerInfoBtn').addEventListener('click', showBrokerInfo);

  // Update broker select when remittance type changes
  document.querySelectorAll('input[name="remitType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isDirect = radio.value === REMITTANCE_TYPES.DIRECT_WALLET;
      const brokerSection = $('brokerSelect').parentElement;
      if (brokerSection) {
        brokerSection.style.display = isDirect ? 'none' : 'block';
      }
    });
  });
}

// Initialize broker system
function initBroker() {
  loadBrokerList();
  populateBrokerSelect();
  setupBrokerEventListeners();
  logDebug('Broker system initialized');
  logDebug('Total brokers:', brokers.length);
}

// Auto-initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBroker);
} else {
  initBroker();
}
