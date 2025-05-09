const Payout = require('../models/Payout');

// Get all payouts
exports.getPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find();
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get a single payout by ID
exports.getPayoutById = async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ message: "Payout not found" });
    res.json(payout);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all payouts for a specific community
exports.getPayoutsByCommunity = async (req, res) => {
  try {
    const payouts = await Payout.find({ communityId: req.params.communityId });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all payouts by a specific user
exports.getPayoutsByUser = async (req, res) => {
  try {
    const payouts = await Payout.find({ userId: req.params.userId });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a payout
exports.deletePayout = async (req, res) => {
  try {
    const { id } = req.params;
    const payout = await Payout.findByIdAndDelete(id);
    if (!payout) return res.status(404).json({ message: "Payout not found" });
    res.json({ message: "Payout deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all payouts
exports.getAllPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find();
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
