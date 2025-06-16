const mongoose = require('mongoose');
const { Schema } = mongoose;

const invitationSchema = new Schema({
  communityId: {
    type: Schema.Types.ObjectId,
    ref: 'Community',
    required: true,
    index: true
  },
  inviterId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  inviteCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  inviteType: {
    type: String,
    enum: ['email', 'phone', 'link'],
    required: true
  },
  inviteeEmail: {
    type: String,
    lowercase: true,
    sparse: true,
    index: true
  },
  inviteePhone: {
    type: String,
    sparse: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },
  customMessage: {
    type: String,
    maxlength: 500
  },
  acceptedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  acceptedAt: Date,
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    source: String
  }
}, {
  timestamps: true
});

// Compound indexes for performance
invitationSchema.index({ communityId: 1, status: 1 });
invitationSchema.index({ inviterId: 1, createdAt: -1 });
invitationSchema.index({ expiresAt: 1, status: 1 });

// Pre-save middleware to set expiration date if not provided
invitationSchema.pre('save', function(next) {
  if (!this.expiresAt) {
    // Default to 7 days from creation
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  next();
});

// Virtual for checking if invitation is expired
invitationSchema.virtual('isExpired').get(function() {
  return this.expiresAt < new Date() && this.status === 'pending';
});

// Static method to find expired invitations
invitationSchema.statics.findExpired = function() {
  return this.find({
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });
};

// Instance method to check if invitation can be accepted
invitationSchema.methods.canBeAccepted = function() {
  return this.status === 'pending' && this.expiresAt > new Date();
};

// Instance method to accept invitation
invitationSchema.methods.accept = function(userId) {
  if (!this.canBeAccepted()) {
    throw new Error('Invitation cannot be accepted');
  }
  
  this.status = 'accepted';
  this.acceptedBy = userId;
  this.acceptedAt = new Date();
  
  return this.save();
};

module.exports = mongoose.model('Invitation', invitationSchema);
