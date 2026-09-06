/* ===== REMITTANCE MANAGEMENT ===== */

// Store remittances locally
let remittances = JSON.parse(localStorage.getItem(CONFIG.REMITTANCE.storageKey)) || [];

// Remittance types
const REMITTANCE_TYPES = {
  DIRECT_WALLET: 'direct_wallet',      // مباشر إلى محفظة
  BROKER_WEBSITE: 'broker_website',    // عبر موقع الوسيط
  BANK_TRANSFER: 'bank_transfer'       // تحويل بنكي
};

// Remittance statuses
const REMITTANCE_STATUS = {
  PENDING: 'pending',           // قيد الانتظار
  PROCESSING: 'processing',     // قيد المعالجة
  SENT_TO_BROKER: 'sent_to_broker', // أُرسلت للوسيط
  COMPLETED: 'completed',       // مكتملة
  FAILED: 'failed',             // فشلت
  CANCELLED: 'cancelled'        // ملغاة
};

// Create a new remittance
async function createRemittance() {
  const remitType = document.querySelector('input[name="remitType"]:checked')?.value || REMITTANCE_TYPES.DIRECT_WALLET;
  const asset = $('remitAsset').value;
  const amount = parseFloat($('remitAmount').value);
  const recipient = $('remitRecipient').value.trim();
  const brokerAddr = $('brokerSelect').value;
  const statusEl = $('remitStatus');

  // Validation
  if (!amount || amount <= 0 || amount > CONFIG.REMITTANCE.maxAmount) {
    showStatus(statusEl, 'err', `المبلغ يجب أن يكون بين 0 و ${CONFIG.REMITTANCE.maxAmount}`);
    return;
  }

  if (!recipient) {
    showStatus(statusEl, 'err', 'الرجاء إدخال بيانات المستقبل');
    return;
  }

  // Validate based on type
  if (remitType === REMITTANCE_TYPES.DIRECT_WALLET && !isValidAddress(recipient)) {
    showStatus(statusEl, 'err', 'عنوان محفظة غير صالح');
    return;
  }

  if (remitType === REMITTANCE_TYPES.BROKER_WEBSITE && !brokerAddr) {
    showStatus(statusEl, 'err', 'الرجاء اختيار وسيط');
    return;
  }

  try {
    $('sendRemitBtn').disabled = true;
    showStatus(statusEl, 'pending', 'جارٍ معالجة الحواله...');

    let txHash = null;
    let brokerFee = 0;

    // Get broker details if selected
    let brokerInfo = null;
    if (brokerAddr) {
      brokerInfo = loadBrokers().find(b => b.address === brokerAddr);
      brokerFee = calculateFee(amount, brokerInfo?.feeRate || CONFIG.BROKER.defaultCommissionRate);
    }

    // Step 1: Send funds based on remittance type
    if (remitType === REMITTANCE_TYPES.DIRECT_WALLET) {
      // Direct transfer to wallet
      txHash = await sendDirectTransfer(asset, recipient, amount, statusEl);
    } else if (remitType === REMITTANCE_TYPES.BROKER_WEBSITE) {
      // Send to broker's wallet
      txHash = await sendDirectTransfer(asset, brokerAddr, amount + brokerFee, statusEl);
    }

    // Step 2: Create remittance record
    const remittance = {
      id: generateId(),
      type: remitType,
      status: REMITTANCE_STATUS.SENT_TO_BROKER,
      asset,
      amount,
      brokerFee,
      totalAmount: amount + brokerFee,
      recipient,
      brokerAddress: brokerAddr,
      brokerInfo: brokerInfo ? {
        name: brokerInfo.name,
        phone: brokerInfo.phone
      } : null,
      senderAddress: account,
      txHash,
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      notes: ''
    };

    // Save remittance
    remittances.unshift(remittance);
    saveRemittances();

    // Show success message
    if (remitType === REMITTANCE_TYPES.BROKER_WEBSITE) {
      showStatus(statusEl, 'ok', `
        <strong>تم إرسال الحواله للوسيط بنجاح!</strong><br>
        المبلغ: ${amount} ${getAssetSymbol(asset)}<br>
        عمولة الوسيط: ${brokerFee.toFixed(4)} ${getAssetSymbol(asset)}<br>
        <a href="${getBscScanUrl('tx', txHash)}" target="_blank" style="color:var(--teal)">عرض المعاملة ↗</a><br>
        ${brokerInfo ? `<small>تواصل مع الوسيط: ${brokerInfo.phone}</small>` : ''}
      `);
    } else {
      showStatus(statusEl, 'ok', `
        <strong>تم إرسال الحواله بنجاح!</strong><br>
        المبلغ: ${amount} ${getAssetSymbol(asset)}<br>
        إلى: ${shortAddress(recipient)}<br>
        <a href="${getBscScanUrl('tx', txHash)}" target="_blank" style="color:var(--teal)">عرض المعاملة ↗</a>
      `);
    }

    // Clear form
    $('remitAmount').value = '';
    $('remitRecipient').value = '';
    $('brokerSelect').value = '';

    // Update UI
    setTimeout(() => {
      refreshNativeBalance();
      loadTokenList();
      loadRemittanceHistory();
    }, 2000);

  } catch (err) {
    showStatus(statusEl, 'err', 'فشلت الحواله: ' + (err.reason || err.message || err));
    logError('Remittance error:', err);
  } finally {
    $('sendRemitBtn').disabled = false;
  }
}

// Send direct transfer (to wallet or broker)
async function sendDirectTransfer(assetAddress, toAddress, amount, statusEl) {
  try {
    const amountBN = assetAddress === 'native' 
      ? ethers.utils.parseEther(amount.toString())
      : ethers.utils.parseUnits(amount.toString(), 18); // Default decimals

    let tx;

    if (assetAddress === 'native') {
      // Native BNB transfer
      showStatus(statusEl, 'pending', 'الرجاء تأكيد المعاملة في محفظتك...');
      
      tx = await signer.sendTransaction({
        to: toAddress,
        value: amountBN
      });
    } else {
      // ERC20 token transfer
      showStatus(statusEl, 'pending', 'الرجاء تأكيد المعاملة في محفظتك...');
      
      const contract = new ethers.Contract(assetAddress, CONFIG.ERC20_ABI, signer);
      const decimals = await contract.decimals();
      const amountWithDecimals = ethers.utils.parseUnits(amount.toString(), decimals);
      
      tx = await contract.transfer(toAddress, amountWithDecimals);
    }

    showStatus(statusEl, 'pending', `تم إرسال المعاملة، بانتظار التأكيد...<br>الهاش: ${shortAddress(tx.hash)}`);
    
    // Wait for confirmation
    const receipt = await tx.wait(CONFIG.TX.confirmations);

    if (receipt.status === 0) {
      throw new Error('فشلت المعاملة على البلوكتشين');
    }

    return tx.hash;

  } catch (err) {
    logError('Transfer error:', err);
    throw err;
  }
}

// Load remittance history
function loadRemittanceHistory() {
  const historyList = $('historyList');
  const filterValue = $('historyFilter')?.value || 'all';

  if (remittances.length === 0) {
    historyList.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:16px;">لا توجد معاملات سابقة</div>';
    return;
  }

  let filtered = remittances;

  // Apply filter
  if (filterValue === 'sent') {
    filtered = remittances.filter(r => r.senderAddress === account);
  } else if (filterValue === 'received') {
    filtered = remittances.filter(r => r.recipient === account);
  } else if (filterValue === 'pending') {
    filtered = remittances.filter(r => r.status === REMITTANCE_STATUS.PENDING || r.status === REMITTANCE_STATUS.PROCESSING);
  } else if (filterValue === 'completed') {
    filtered = remittances.filter(r => r.status === REMITTANCE_STATUS.COMPLETED);
  }

  historyList.innerHTML = '';

  filtered.forEach(remit => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const typeLabel = remit.type === REMITTANCE_TYPES.DIRECT_WALLET 
      ? '💳 تحويل مباشر'
      : remit.type === REMITTANCE_TYPES.BROKER_WEBSITE
      ? '🏢 عبر الوسيط'
      : '🏦 تحويل بنكي';

    const statusBadge = getStatusBadge(remit.status);
    const isSent = remit.senderAddress === account;

    item.innerHTML = `
      <div class="history-main">
        <div class="history-header">
          <span class="history-type">${typeLabel}</span>
          <span class="history-status ${remit.status}">${statusBadge}</span>
        </div>
        <div class="history-detail">
          <span>${isSent ? 'إلى' : 'من'}: ${shortAddress(isSent ? remit.recipient : remit.senderAddress)}</span>
          ${remit.brokerInfo ? `<span>الوسيط: ${remit.brokerInfo.name}</span>` : ''}
          <span>${formatTimestamp(remit.createdAt)}</span>
        </div>
      </div>
      <div class="history-amount">
        <div class="history-value" style="${isSent ? 'color:var(--danger)' : 'color:var(--success)'}">${isSent ? '-' : '+'} ${remit.amount} ${getAssetSymbol(remit.asset)}</div>
        <div class="history-timestamp">
          ${remit.brokerFee ? `عمولة: ${remit.brokerFee.toFixed(4)}` : ''}
        </div>
        ${remit.txHash ? `<a href="${getBscScanUrl('tx', remit.txHash)}" target="_blank" style="font-size:11px;color:var(--primary-light)">عرض التفاصيل ↗</a>` : ''}
      </div>
    `;

    historyList.appendChild(item);
  });
}

// Get status badge text
function getStatusBadge(status) {
  const badges = {
    [REMITTANCE_STATUS.PENDING]: '⏳ قيد الانتظار',
    [REMITTANCE_STATUS.PROCESSING]: '⚙️ قيد المعالجة',
    [REMITTANCE_STATUS.SENT_TO_BROKER]: '📤 أُرسلت',
    [REMITTANCE_STATUS.COMPLETED]: '✅ مكتملة',
    [REMITTANCE_STATUS.FAILED]: '❌ فشلت',
    [REMITTANCE_STATUS.CANCELLED]: '⛔ ملغاة'
  };
  return badges[status] || 'غير معروف';
}

// Get asset symbol
function getAssetSymbol(assetAddress) {
  if (assetAddress === 'native') return 'BNB';
  
  const token = DEFAULT_TOKENS.find(t => t.address === assetAddress);
  return token?.symbol || shortAddress(assetAddress);
}

// Set max amount
async function setMaxAmount() {
  try {
    const asset = $('remitAsset').value;
    const balance = await getBalance(asset);

    if (asset === 'native') {
      // Leave buffer for gas
      const buffer = ethers.utils.parseEther('0.001');
      const max = balance.gt(buffer) ? balance.sub(buffer) : ethers.BigNumber.from(0);
      $('remitAmount').value = ethers.utils.formatEther(max);
    } else {
      $('remitAmount').value = ethers.utils.formatUnits(balance, 18);
    }

    updateFeeDisplay();
  } catch (e) {
    logError('Set max amount error:', e);
  }
}

// Update fee display
function updateFeeDisplay() {
  const amount = parseFloat($('remitAmount').value) || 0;
  const brokerAddr = $('brokerSelect').value;
  const remitType = document.querySelector('input[name="remitType"]:checked')?.value;

  let brokerFee = 0;

  if (brokerAddr && remitType === REMITTANCE_TYPES.BROKER_WEBSITE) {
    const broker = loadBrokers().find(b => b.address === brokerAddr);
    brokerFee = calculateFee(amount, broker?.feeRate || CONFIG.BROKER.defaultCommissionRate);
  }

  $('feeBase').textContent = formatNumber(amount);
  $('feeBroker').textContent = formatNumber(brokerFee);
  $('feeTotal').textContent = formatNumber(amount + brokerFee);

  // Update fee when amount changes
  estimateAndDisplayGas(amount);
}

// Estimate and display gas fee
async function estimateAndDisplayGas(amount) {
  try {
    if (!amount || amount <= 0) {
      $('feeGas').textContent = '0.00';
      return;
    }

    const asset = $('remitAsset').value;
    const recipient = $('remitRecipient').value.trim();

    if (!recipient) return;

    let gasLimit;
    if (asset === 'native') {
      gasLimit = CONFIG.GAS.transferNative;
    } else {
      gasLimit = CONFIG.GAS.transferToken;
    }

    const gasPrice = await getGasPrice();
    const gasCost = gasLimit * parseInt(gasPrice);
    const gasCostBNB = ethers.utils.formatEther(gasCost);

    $('feeGas').textContent = formatNumber(gasCostBNB);
  } catch (e) {
    logError('Gas estimation error:', e);
    $('feeGas').textContent = '~0.001';
  }
}

// Save remittances to localStorage
function saveRemittances() {
  localStorage.setItem(CONFIG.REMITTANCE.storageKey, JSON.stringify(remittances));
}

// Generate unique ID
function generateId() {
  return `remit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Setup remittance type radio buttons
function setupRemittanceTypeRadios() {
  const container = document.createElement('div');
  container.className = 'form-group';
  container.innerHTML = `
    <label>طريقة الإرسال</label>
    <div style="display:flex;gap:16px;margin-top:8px;">
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
        <input type="radio" name="remitType" value="${REMITTANCE_TYPES.DIRECT_WALLET}" checked>
        <span>💳 مباشر للمحفظة</span>
      </label>
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
        <input type="radio" name="remitType" value="${REMITTANCE_TYPES.BROKER_WEBSITE}">
        <span>🏢 عبر موقع الوسيط</span>
      </label>
    </div>
  `;

  const formSection = document.querySelector('#view-remittance .form-section');
  if (formSection) {
    formSection.insertBefore(container, formSection.firstChild);
  }

  // Update fields based on selection
  document.querySelectorAll('input[name="remitType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isDirect = radio.value === REMITTANCE_TYPES.DIRECT_WALLET;
      $('remitRecipient').placeholder = isDirect 
        ? '0x...' 
        : 'اسم المستقبل أو رقمه';
      $('brokerSelect').disabled = isDirect;
      updateFeeDisplay();
    });
  });
}

// Event listeners for remittance
function setupRemittanceEventListeners() {
  $('sendRemitBtn').addEventListener('click', createRemittance);
  $('maxBtn').addEventListener('click', setMaxAmount);
  $('remitAmount').addEventListener('input', updateFeeDisplay);
  $('brokerSelect').addEventListener('change', updateFeeDisplay);
  $('refreshHistoryBtn')?.addEventListener('click', loadRemittanceHistory);
  $('historyFilter')?.addEventListener('change', loadRemittanceHistory);
}

// Initialize remittance
function initRemittance() {
  setupRemittanceTypeRadios();
  setupRemittanceEventListeners();
  logDebug('Remittance system initialized');
}

// Auto-initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRemittance);
} else {
  initRemittance();
}
