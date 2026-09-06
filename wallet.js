/* ===== WALLET MANAGEMENT ===== */

let provider, signer, account;
let isReadOnly = false;
let connectionKind = null; // 'injected' | 'walletconnect' | 'readonly'
let wcProvider = null;
let tokenAddresses = [...DEFAULT_TOKENS.map(t => t.address)];

// Connect to browser wallet (MetaMask, Trust Wallet, etc.)
async function connectInjected() {
  if (!window.ethereum) {
    showStatus($('connectMsg'), 'err',
      'لم يتم العثور على محفظة متصفح. افتح هذه الصفحة داخل متصفح محفظة (MetaMask، Trust Wallet، Coinbase Wallet...)');
    return;
  }

  try {
    $('connectInjectedBtn').disabled = true;
    $('connectInjectedBtn').textContent = 'جارٍ الاتصال...';

    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Create provider
    provider = new ethers.providers.Web3Provider(window.ethereum);

    // Ensure we're on BSC
    await ensureBscNetworkInjected();

    // Get signer and account
    signer = provider.getSigner();
    account = await signer.getAddress();
    isReadOnly = false;
    connectionKind = 'injected';

    // Listen for account and network changes
    window.ethereum.on('accountsChanged', () => location.reload());
    window.ethereum.on('chainChanged', () => location.reload());

    logDebug('Connected with injected wallet:', account);
    await enterMainView();
  } catch (err) {
    showStatus($('connectMsg'), 'err', 'تعذّر الاتصال: ' + (err.message || err));
    logError('Connection failed:', err);
  } finally {
    $('connectInjectedBtn').disabled = false;
    $('connectInjectedBtn').textContent = 'الاتصال بمحفظة المتصفح (MetaMask / Trust / Coinbase...)';
  }
}

// Ensure the network is set to BSC
async function ensureBscNetworkInjected() {
  const network = await provider.getNetwork();
  
  if (network.chainId !== BSC_CONFIG.chainId) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BSC_CONFIG.chainIdHex }]
      });
    } catch (switchErr) {
      // Network not added, add it
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BSC_CONFIG.chainIdHex,
            chainName: BSC_CONFIG.chainName,
            nativeCurrency: BSC_CONFIG.nativeCurrency,
            rpcUrls: BSC_CONFIG.rpcUrls,
            blockExplorerUrls: BSC_CONFIG.blockExplorerUrls
          }]
        });
      } else {
        throw switchErr;
      }
    }
    // Refresh provider after network switch
    provider = new ethers.providers.Web3Provider(window.ethereum);
  }
}

// Connect via WalletConnect (mobile wallets)
async function connectWalletConnect() {
  if (WALLETCONNECT_CONFIG.projectId === 'YOUR_WALLETCONNECT_PROJECT_ID') {
    showStatus($('connectMsg'), 'err',
      'إعداد ناقص: أضف WALLETCONNECT_PROJECT_ID الخاص بك (مجاني من cloud.walletconnect.com)');
    return;
  }

  try {
    $('connectWcBtn').disabled = true;
    $('connectWcBtn').textContent = 'جارٍ فتح WalletConnect...';

    // Initialize EthereumProvider
    wcProvider = await EthereumProvider.init({
      projectId: WALLETCONNECT_CONFIG.projectId,
      chains: [BSC_CONFIG.chainId],
      showQrModal: true,
      metadata: {
        name: WALLETCONNECT_CONFIG.name,
        description: WALLETCONNECT_CONFIG.description,
        url: WALLETCONNECT_CONFIG.url,
        icons: WALLETCONNECT_CONFIG.icons
      }
    });

    // Enable connection
    await wcProvider.enable();

    // Create provider and signer
    provider = new ethers.providers.Web3Provider(wcProvider);
    signer = provider.getSigner();
    account = await signer.getAddress();
    isReadOnly = false;
    connectionKind = 'walletconnect';

    // Listen for changes
    wcProvider.on('accountsChanged', () => location.reload());
    wcProvider.on('chainChanged', () => location.reload());
    wcProvider.on('disconnect', () => location.reload());

    logDebug('Connected with WalletConnect:', account);
    await enterMainView();
  } catch (err) {
    showStatus($('connectMsg'), 'err', 'تعذّر الاتصال عبر WalletConnect: ' + (err.message || err));
    logError('WalletConnect connection failed:', err);
  } finally {
    $('connectWcBtn').disabled = false;
    $('connectWcBtn').textContent = 'الاتصال عبر WalletConnect (أي محفظة جوال)';
  }
}

// Connect in read-only mode (view only)
function watchOnly() {
  const addr = prompt('أدخل عنوان المحفظة لعرضه (0x...):');
  
  if (!addr || !isValidAddress(addr)) {
    showStatus($('connectMsg'), 'err', 'عنوان غير صالح.');
    return;
  }

  // Create read-only provider
  provider = new ethers.providers.JsonRpcProvider(NETWORK_CONFIG.readOnlyRpc);
  account = ethers.utils.getAddress(addr);
  isReadOnly = true;
  signer = null;
  connectionKind = 'readonly';

  logDebug('Connected in read-only mode:', account);
  enterMainView();
}

// Disconnect wallet
async function disconnectWallet() {
  try {
    if (connectionKind === 'walletconnect' && wcProvider) {
      await wcProvider.disconnect();
    }
  } catch (e) {
    logError('Disconnect error:', e);
  }
  location.reload();
}

// Enter main application view
async function enterMainView() {
  $('connectView').classList.add('hidden');
  $('mainView').classList.remove('hidden');

  // Update UI
  setChainStatus(true, isReadOnly ? 'عرض فقط · BSC' : 'متصل · BSC');
  $('accountAddr').textContent = shortAddress(account);
  $('receiveAddr').value = account;
  $('qrAddr').value = account;
  $('explorerLink').href = getBscScanUrl('address', account);

  // Update wallet kind note
  const kindLabels = {
    'injected': 'متصل عبر محفظة المتصفح',
    'walletconnect': 'متصل عبر WalletConnect',
    'readonly': 'وضع عرض فقط'
  };
  $('walletKindNote').textContent = kindLabels[connectionKind] || '';
  $('disconnectBtn').classList.toggle('hidden', connectionKind === 'readonly');

  // Disable send functionality in read-only mode
  if (isReadOnly) {
    $('sendRemitBtn').disabled = true;
    $('sendRemitBtn').textContent = 'وضع العرض فقط — لا يمكن الإرسال';
  }

  // Generate QR code for receiving
  try {
    new QRCode($('qrBox'), {
      text: account,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff'
    });
  } catch (e) {
    logError('QR code generation error:', e);
  }

  // Load balances and data
  await refreshNativeBalance();
  await loadTokenList();
  populateSendAssetOptions();
}

// Refresh BNB balance
async function refreshNativeBalance() {
  try {
    const bal = await provider.getBalance(account);
    $('bnbBalance').textContent = formatNumber(ethers.utils.formatEther(bal));
  } catch (e) {
    logError('Balance refresh error:', e);
    $('bnbBalance').textContent = '0.00';
  }
}

// Get token information
async function getTokenInfo(address) {
  try {
    const contract = new ethers.Contract(address, CONFIG.ERC20_ABI, provider);
    
    const [symbol, decimals, balance, name] = await Promise.all([
      contract.symbol().catch(() => 'UNKNOWN'),
      contract.decimals().catch(() => 18),
      contract.balanceOf(account).catch(() => ethers.BigNumber.from(0)),
      contract.name().catch(() => address)
    ]);

    return {
      address,
      symbol,
      name,
      decimals,
      balance
    };
  } catch (e) {
    logError('Token info fetch error:', e);
    return null;
  }
}

// Load token list
async function loadTokenList() {
  const listEl = $('tokenList');
  listEl.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:8px 0;">جارٍ التحميل...</div>';

  const infos = [];
  for (const addr of tokenAddresses) {
    try {
      const info = await getTokenInfo(addr);
      if (info) infos.push(info);
    } catch (e) {
      logError('Token loading error:', e);
    }
  }

  listEl.innerHTML = '';
  
  if (infos.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-dim);font-size:12px;">لا توجد عملات مضافة.</div>';
    return;
  }

  infos.forEach(t => {
    const row = document.createElement('div');
    row.className = 'token-item';
    const balance = ethers.utils.formatUnits(t.balance, t.decimals);
    row.innerHTML = `
      <div class="token-left">
        <div class="token-badge">${t.symbol.slice(0, 3).toUpperCase()}</div>
        <div class="token-info">
          <div class="token-symbol">${t.symbol}</div>
          <div class="token-address">${shortAddress(t.address)}</div>
        </div>
      </div>
      <div class="token-balance">
        <div class="token-balance-value">${formatNumber(balance)}</div>
        <div class="token-balance-label">${t.symbol}</div>
      </div>
    `;
    listEl.appendChild(row);
  });
}

// Populate send asset dropdown
function populateSendAssetOptions() {
  const sel = $('remitAsset');
  sel.innerHTML = '<option value="native">BNB (الأصلية)</option>';

  tokenAddresses.forEach(addr => {
    const opt = document.createElement('option');
    opt.value = addr;
    opt.textContent = shortAddress(addr);
    sel.appendChild(opt);
  });
}

// Add a new token
async function addToken() {
  const addr = $('newTokenAddr').value.trim();

  if (!isValidAddress(addr)) {
    showStatus($('tokenStatus'), 'err', 'عنوان عقد غير صالح');
    return;
  }

  if (tokenAddresses.includes(addr)) {
    showStatus($('tokenStatus'), 'err', 'العملة موجودة بالفعل');
    return;
  }

  try {
    // Verify token exists
    const info = await getTokenInfo(addr);
    if (!info) throw new Error('لم يتم العثور على العملة');

    tokenAddresses.push(addr);
    $('newTokenAddr').value = '';
    
    showStatus($('tokenStatus'), 'ok', `تمت إضافة ${info.symbol} بنجاح`);
    
    setTimeout(() => {
      $('tokenStatus').innerHTML = '';
      loadTokenList();
      populateSendAssetOptions();
    }, 1500);

  } catch (e) {
    showStatus($('tokenStatus'), 'err', 'خطأ: ' + (e.message || e));
    logError('Add token error:', e);
  }
}

// Set chain status indicator
function setChainStatus(ok, label) {
  $('chainDot').className = 'dot ' + (ok ? 'ok' : 'bad');
  $('chainLabel').textContent = label;
}

// Show status message
function showStatus(el, type, msg) {
  el.innerHTML = `<div class="status-msg ${type}">${msg}</div>`;
}

// Get read-only provider
function getReadOnlyProvider() {
  return new ethers.providers.JsonRpcProvider(NETWORK_CONFIG.readOnlyRpc);
}

// Estimate gas for transaction
async function estimateGas(txData) {
  try {
    const gasEstimate = await provider.estimateGas(txData);
    return gasEstimate.mul(Math.ceil(CONFIG.GAS.safetyMultiplier * 100)).div(100);
  } catch (e) {
    logError('Gas estimation error:', e);
    // Return default estimate
    if (txData.to && txData.data) {
      return ethers.BigNumber.from(CONFIG.GAS.transferToken);
    }
    return ethers.BigNumber.from(CONFIG.GAS.transferNative);
  }
}

// Get current gas price
async function getGasPrice() {
  try {
    const gasPrice = await provider.getGasPrice();
    return gasPrice;
  } catch (e) {
    logError('Gas price fetch error:', e);
    return ethers.utils.parseUnits('1', 'gwei');
  }
}

// Get account balance
async function getBalance(assetAddress = null) {
  try {
    if (!assetAddress || assetAddress === 'native') {
      return await provider.getBalance(account);
    } else {
      const contract = new ethers.Contract(assetAddress, CONFIG.ERC20_ABI, provider);
      return await contract.balanceOf(account);
    }
  } catch (e) {
    logError('Balance fetch error:', e);
    return ethers.BigNumber.from(0);
  }
}

// Helper: $ selector
const $ = id => document.getElementById(id);

// Event listeners setup
function setupWalletEventListeners() {
  $('connectInjectedBtn').addEventListener('click', connectInjected);
  $('connectWcBtn').addEventListener('click', connectWalletConnect);
  $('watchBtn').addEventListener('click', watchOnly);
  $('disconnectBtn').addEventListener('click', disconnectWallet);

  $('copyAddrBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(account).then(() => {
      $('copyAddrBtn').textContent = 'تم!';
      setTimeout(() => {
        $('copyAddrBtn').textContent = '📋';
      }, 1200);
    });
  });

  $('qrCopyBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(account).then(() => {
      $('qrCopyBtn').textContent = 'تم النسخ!';
      setTimeout(() => {
        $('qrCopyBtn').textContent = 'نسخ';
      }, 1200);
    });
  });

  $('qrModalClose').addEventListener('click', () => {
    $('qrModal').classList.remove('active');
  });

  $('qrModal').addEventListener('click', (e) => {
    if (e.target === $('qrModal')) {
      $('qrModal').classList.remove('active');
    }
  });
}

// Initialize wallet
function initWallet() {
  setChainStatus(false, 'غير متصل');
  setupWalletEventListeners();
  logDebug('Wallet initialized');
}

// Auto-initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWallet);
} else {
  initWallet();
}
