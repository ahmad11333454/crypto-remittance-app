/* ===== BLOCKCHAIN CONFIGURATION ===== */

// BSC (BNB Smart Chain) Configuration
const BSC_CONFIG = {
  chainId: 56,
  chainIdHex: '0x38',
  chainName: 'BNB Smart Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18
  },
  rpcUrls: [
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.debnodes.org',
    'https://bsc-dataseed2.debnodes.org'
  ],
  blockExplorerUrls: ['https://bscscan.com'],
  blockExplorerName: 'BscScan'
};

// Default Tokens on BSC
const DEFAULT_TOKENS = [
  {
    symbol: 'USDT',
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 6,
    name: 'Tether USD'
  },
  {
    symbol: 'BUSD',
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    decimals: 18,
    name: 'Binance USD'
  },
  {
    symbol: 'USDC',
    address: '0x8AC76a51cc950d9822D68b83FE1Ad97B32Cd580d',
    decimals: 6,
    name: 'USD Coin'
  },
  {
    symbol: 'CAKE',
    address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
    decimals: 18,
    name: 'PancakeSwap Token'
  },
  {
    symbol: 'ETH',
    address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    decimals: 18,
    name: 'Ethereum Token'
  }
];

// ERC20 ABI (minimal)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

// Gas Estimation Configuration
const GAS_CONFIG = {
  // Standard gas limits for different transaction types
  transferNative: 21000,        // Simple BNB transfer
  transferToken: 65000,         // ERC20 token transfer
  approveToken: 45000,          // Token approval
  
  // Multipliers for safety margin
  safetyMultiplier: 1.2,        // 20% safety margin
  
  // Gas price settings (in gwei)
  // Will be fetched dynamically from network
  minGasPrice: 1,
  maxGasPrice: 100
};

// Broker Configuration
const BROKER_CONFIG = {
  // Minimum and maximum commission rates (in percentage)
  minCommissionRate: 0.5,       // 0.5%
  maxCommissionRate: 5,         // 5%
  defaultCommissionRate: 2,     // 2% default
  
  // Minimum commission amount (in smallest unit)
  minCommissionAmount: 0.001,
  
  // Storage key for brokers in localStorage
  storageKey: 'crypto_brokers'
};

// Transaction Configuration
const TX_CONFIG = {
  // Timeout for transaction confirmation (in milliseconds)
  confirmationTimeout: 300000,  // 5 minutes
  
  // Number of block confirmations to wait
  confirmations: 1,
  
  // Storage key for transaction history
  storageKey: 'crypto_tx_history',
  
  // Maximum number of stored transactions
  maxStoredTransactions: 100
};

// Remittance Configuration
const REMITTANCE_CONFIG = {
  // Minimum and maximum remittance amounts
  minAmount: 0.001,
  maxAmount: 1000,
  
  // Storage key
  storageKey: 'crypto_remittances',
  
  // Maximum stored remittances
  maxStored: 50,
  
  // Default status
  defaultStatus: 'pending'
};

// WalletConnect Configuration
const WALLETCONNECT_CONFIG = {
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // Replace with your actual project ID
  name: 'تطبيق الحواله',
  description: 'تطبيق حواله آمن وسريع للعملات الرقمية',
  url: typeof window !== 'undefined' ? window.location.origin : '',
  icons: []
};

// UI Configuration
const UI_CONFIG = {
  // Decimal places for display
  displayDecimals: 4,
  
  // Toast/notification duration (in milliseconds)
  notificationDuration: 4000,
  
  // Debounce delay for input events (in milliseconds)
  debounceDelay: 300,
  
  // Animation duration (in milliseconds)
  animationDuration: 300
};

// Network Configuration
const NETWORK_CONFIG = {
  // Read-only RPC endpoint for fallback
  readOnlyRpc: 'https://bsc-dataseed.binance.org',
  
  // API endpoints for data fetching
  blockExplorerApi: 'https://api.bscscan.com/api',
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000
};

// Export all configurations
const CONFIG = {
  BSC: BSC_CONFIG,
  DEFAULT_TOKENS,
  ERC20_ABI,
  GAS: GAS_CONFIG,
  BROKER: BROKER_CONFIG,
  TX: TX_CONFIG,
  REMITTANCE: REMITTANCE_CONFIG,
  WALLETCONNECT: WALLETCONNECT_CONFIG,
  UI: UI_CONFIG,
  NETWORK: NETWORK_CONFIG
};

// Utility function to get BSC explorer URL
function getBscScanUrl(type, value) {
  const baseUrl = 'https://bscscan.com';
  const typeMap = {
    address: '/address/',
    tx: '/tx/',
    block: '/block/',
    token: '/token/'
  };
  return baseUrl + (typeMap[type] || '/') + value;
}

// Utility function to format numbers with decimals
function formatNumber(num, decimals = CONFIG.UI.displayDecimals) {
  return parseFloat(num).toFixed(decimals);
}

// Utility function to shorten address
function shortAddress(address) {
  if (!address) return '';
  return address.slice(0, 6) + '…' + address.slice(-4);
}

// Utility function to format large numbers with K, M, B suffix
function formatLargeNumber(num, decimals = 2) {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(decimals) + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(decimals) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(decimals) + 'K';
  }
  return num.toFixed(decimals);
}

// Utility function to validate Ethereum address
function isValidAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Utility function to validate phone number (simple)
function isValidPhone(phone) {
  return /^\+?[\d\s\-()]{10,}$/.test(phone);
}

// Utility function to get current timestamp
function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// Utility function to format timestamp to readable date
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('ar-SA');
}

// Utility function to calculate fee
function calculateFee(amount, feePercentage) {
  return (amount * feePercentage) / 100;
}

// Utility function to calculate total with fee
function calculateTotal(amount, feePercentage) {
  return amount + calculateFee(amount, feePercentage);
}

// Debug logging utility
function logDebug(message, data = null) {
  if (typeof console !== 'undefined' && console.log) {
    console.log(`[DEBUG] ${message}`, data || '');
  }
}

// Error logging utility
function logError(message, error = null) {
  if (typeof console !== 'undefined' && console.error) {
    console.error(`[ERROR] ${message}`, error || '');
  }
}
