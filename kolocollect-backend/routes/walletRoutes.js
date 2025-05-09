const express = require('express');
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();
router.use(authMiddleware);

// Wallet operations
router.get('/:userId/balance', walletController.getWalletBalance); // Fetch wallet balance
router.get('/:userId', walletController.getWallet); // Fetch full wallet details
router.post('/create', walletController.createWallet);


router.post('/add-funds', walletController.addFunds);
router.post('/withdraw-funds', walletController.withdrawFunds);
router.post('/transfer-funds', walletController.transferFunds);
router.get('/:userId/transactions', walletController.getTransactionHistory);
router.post('/:userId/fix-funds', walletController.fixFunds);
router.get('/:userId/fixed-funds', walletController.getFixedFunds);

module.exports = router;
