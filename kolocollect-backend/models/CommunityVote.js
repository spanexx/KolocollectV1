const mongoose = require('mongoose');

const CommunityVoteSchema = new mongoose.Schema({
    communityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    topic: { type: String, required: true },
    options: [{ type: String }],
    votes: [{ userId: mongoose.Schema.Types.ObjectId, choice: String }],
    numVotes: { type: Number, default: 0 },
    resolved: { type: Boolean, default: false },
    resolution: { type: String },
    applied: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('CommunityVote', CommunityVoteSchema);